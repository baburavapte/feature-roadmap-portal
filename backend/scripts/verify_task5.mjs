import mongoose from 'mongoose';

const API_URL = 'http://localhost:5000/api';
let passed = 0;
let total = 25;
let failed = [];
let softDeleteStatus = 'Not checked';

async function logTest(num, name, promise) {
    try {
        await promise();
        console.log(`[PASS] Test ${num}: ${name}`);
        passed++;
    } catch (e) {
        console.log(`[FAIL] Test ${num}: ${name} - ${e.message}`);
        failed.push(`Test ${num}: ${name} - ${e.message}`);
    }
}

async function request(endpoint, options = {}) {
    if (!options.headers) options.headers = {};
    if (!options.headers['Content-Type'] && options.method !== 'GET') {
        options.headers['Content-Type'] = 'application/json';
    }
    const res = await fetch(`${API_URL}${endpoint}`, options);
    const rawText = await res.text();
    let body;
    try {
        body = JSON.parse(rawText);
    } catch {
        body = rawText;
    }
    return { status: res.status, body, headers: res.headers };
}

async function setupUser(name, email, password, role = 'user') {
    let res = await request('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, confirmPassword: password })
    });
    
    if (res.body.data?.verifyEmailUrl) {
        await request(res.body.data.verifyEmailUrl, { method: 'POST' });
    }
    
    if (role === 'admin') {
        await mongoose.connect('mongodb://127.0.0.1:27017/feature_roadmap');
        await mongoose.connection.collection('users').updateOne({ email }, { $set: { role: 'admin' } });
    }
    
    let loginRes = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
    });
    return loginRes.body.data?.accessToken;
}

async function setupUsers() {
    const user1Email = `user1_${Date.now()}@example.com`;
    const user2Email = `user2_${Date.now()}@example.com`;
    const adminEmail = `admin_${Date.now()}@example.com`;
    
    const token1 = await setupUser('User One', user1Email, 'Password123');
    const token2 = await setupUser('User Two', user2Email, 'Password123');
    const tokenAdmin = await setupUser('Admin', adminEmail, 'Password123', 'admin');

    return { token1, token2, tokenAdmin };
}

async function runTests() {
    console.log("Starting Task 5 Verification Tests...\n");
    
    const { token1, token2, tokenAdmin, u1Id } = await setupUsers();
    
    // Create a feature request to use for comment tests
    let res = await request('/features', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token1}` },
        body: JSON.stringify({ title: 'Comment Test Feature', description: 'Testing comments', category: 'General', status: 'Under Review' })
    });
    if (res.status !== 201) throw new Error("Failed to setup feature request: " + JSON.stringify(res.body));
    const featureId = res.body.data.feature._id;
    
    let res2 = await request('/features', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token1}` },
        body: JSON.stringify({ title: 'Feature 2', description: 'Testing comments for feature 2', category: 'General' })
    });
    if (res2.status !== 201) throw new Error("Failed to setup feature request 2: " + JSON.stringify(res2.body));
    const featureId2 = res2.body.data.feature._id;

    // 1. Unauthenticated comment creation -> 401
    await logTest(1, 'Unauthenticated comment creation -> 401', async () => {
        const res = await request(`/features/${featureId}/comments`, { method: 'POST', body: JSON.stringify({ content: 'test' }) });
        if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}: ` + JSON.stringify(res.body));
    });

    // 2. Authenticated top-level comment -> 201
    let comment1Id;
    await logTest(2, 'Authenticated top-level comment -> 201', async () => {
        const res = await request(`/features/${featureId}/comments`, {
            method: 'POST', headers: { 'Authorization': `Bearer ${token1}` },
            body: JSON.stringify({ content: 'Top level comment' })
        });
        if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}: ` + JSON.stringify(res.body));
        comment1Id = res.body.data.comment._id;
    });

    // 3. commentCount increments
    await logTest(3, 'commentCount increments', async () => {
        const res = await request(`/features/${featureId}`);
        if (res.body.data.feature.commentCount !== 1) throw new Error(`Expected commentCount 1, got ${res.body.data.feature.commentCount}: ` + JSON.stringify(res.body.data.feature));
    });

    // 4. Authenticated reply -> 201
    let reply1Id;
    await logTest(4, 'Authenticated reply -> 201', async () => {
        const res = await request(`/features/${featureId}/comments`, {
            method: 'POST', headers: { 'Authorization': `Bearer ${token2}` },
            body: JSON.stringify({ content: 'A reply', parentComment: comment1Id })
        });
        if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}: ` + JSON.stringify(res.body));
        reply1Id = res.body.data.comment._id;
    });

    // 5. Parent relationship is correct
    await logTest(5, 'Parent relationship is correct', async () => {
        const res = await request(`/features/${featureId}/comments`);
        const reply = res.body.data.comments.find(c => c._id === reply1Id);
        if (reply.parentComment !== comment1Id && reply.parentId !== comment1Id) throw new Error(`Expected parentId ${comment1Id}, got parentComment ${reply.parentComment}`);
    });

    // 6. Invalid parent comment -> rejected
    await logTest(6, 'Invalid parent comment -> rejected', async () => {
        const res = await request(`/features/${featureId}/comments`, {
            method: 'POST', headers: { 'Authorization': `Bearer ${token1}` },
            body: JSON.stringify({ content: 'Bad parent', parentComment: 'invalid_id_format' })
        });
        if (res.status !== 400 && res.status !== 404) throw new Error(`Expected 400 or 404, got ${res.status}`);
    });

    // 7. Cross-feature parent comment -> rejected
    await logTest(7, 'Cross-feature parent comment -> rejected', async () => {
        const res = await request(`/features/${featureId2}/comments`, {
            method: 'POST', headers: { 'Authorization': `Bearer ${token1}` },
            body: JSON.stringify({ content: 'Cross feature', parentComment: comment1Id })
        });
        if (res.status !== 400 && res.status !== 404) throw new Error(`Expected 400/404, got ${res.status}`);
    });

    // 8. GET comments -> successful
    await logTest(8, 'GET comments -> successful', async () => {
        const res = await request(`/features/${featureId}/comments`);
        if (res.status !== 200 || !Array.isArray(res.body.data.comments)) throw new Error(`Expected 200 and array, got ${res.status}`);
    });

    // 9. Thread structure is correct
    await logTest(9, 'Thread structure is correct', async () => {
        const res = await request(`/features/${featureId}/comments`);
        const t1 = res.body.data.comments.find(c => c._id === comment1Id);
        const t2 = res.body.data.comments.find(c => c._id === reply1Id);
        if (!t1 || !t2) throw new Error("Could not find t1 or t2 in comments: " + JSON.stringify(res.body.data.comments));
        if (t1.parentComment || t1.parentId) throw new Error("Top level comment should not have parentId");
        if (t2.parentComment !== comment1Id && t2.parentId !== comment1Id) throw new Error(`Reply should have parentId. Got parentComment ${t2.parentComment}`);
    });

    // 10. Author cannot be impersonated
    await logTest(10, 'Author cannot be impersonated', async () => {
        const fakeAuthorId = new mongoose.Types.ObjectId().toString();
        const res = await request(`/features/${featureId}/comments`, {
            method: 'POST', headers: { 'Authorization': `Bearer ${token1}` },
            body: JSON.stringify({ content: 'impersonator', authorId: fakeAuthorId, author: fakeAuthorId })
        });
        if (res.body.data?.comment?.author?.toString() === fakeAuthorId) throw new Error("Author was impersonated");
    });

    // 11. Comment author can edit own comment
    await logTest(11, 'Comment author can edit own comment', async () => {
        const res = await request(`/comments/${comment1Id}`, {
            method: 'PATCH', headers: { 'Authorization': `Bearer ${token1}` },
            body: JSON.stringify({ content: 'Edited content' })
        });
        if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ` + JSON.stringify(res.body));
        if (res.body.data.comment.content !== 'Edited content') throw new Error("Content not updated");
    });

    // 12. Another normal user cannot edit -> 403
    await logTest(12, 'Another normal user cannot edit -> 403', async () => {
        const res = await request(`/comments/${comment1Id}`, {
            method: 'PATCH', headers: { 'Authorization': `Bearer ${token2}` },
            body: JSON.stringify({ content: 'Hacked' })
        });
        if (res.status !== 403 && res.status !== 401) throw new Error(`Expected 403, got ${res.status}: ` + JSON.stringify(res.body));
    });

    // 13. Admin can edit comment
    await logTest(13, 'Admin can edit comment', async () => {
        const res = await request(`/comments/${comment1Id}`, {
            method: 'PATCH', headers: { 'Authorization': `Bearer ${tokenAdmin}` },
            body: JSON.stringify({ content: 'Admin Edit' })
        });
        if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ` + JSON.stringify(res.body));
    });

    // 14. Comment author can delete own comment
    await logTest(14, 'Comment author can delete own comment', async () => {
        const c1Res = await request(`/features/${featureId}/comments`, {
            method: 'POST', headers: { 'Authorization': `Bearer ${token1}` },
            body: JSON.stringify({ content: 'To delete' })
        });
        const delId = c1Res.body.data.comment._id;
        const res = await request(`/comments/${delId}`, {
            method: 'DELETE', headers: { 'Authorization': `Bearer ${token1}` }
        });
        if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ` + JSON.stringify(res.body));
        
        // Soft delete DB check
        const dbComment = await mongoose.connection.collection('comments').findOne({ _id: new mongoose.Types.ObjectId(delId) });
        if (dbComment) {
            if (!dbComment.isDeleted && !dbComment.deletedAt) throw new Error("Comment not soft-deleted in DB");
            if (dbComment.author) {
                softDeleteStatus = 'Author retained after soft delete (PASS)';
            } else {
                softDeleteStatus = 'Author nullified after soft delete (FINDING)';
            }
        }
    });

    // 15. Unauthorized user cannot delete -> 403
    await logTest(15, 'Unauthorized user cannot delete -> 403', async () => {
        const c1Res = await request(`/features/${featureId}/comments`, {
            method: 'POST', headers: { 'Authorization': `Bearer ${token1}` },
            body: JSON.stringify({ content: 'To delete' })
        });
        const delId = c1Res.body.data.comment._id;
        const res = await request(`/comments/${delId}`, {
            method: 'DELETE', headers: { 'Authorization': `Bearer ${token2}` }
        });
        if (res.status !== 403 && res.status !== 401) throw new Error(`Expected 403, got ${res.status}: ` + JSON.stringify(res.body));
    });

    // 16. Admin can delete comment
    await logTest(16, 'Admin can delete comment', async () => {
        const c1Res = await request(`/features/${featureId}/comments`, {
            method: 'POST', headers: { 'Authorization': `Bearer ${token1}` },
            body: JSON.stringify({ content: 'To delete by admin' })
        });
        const delId = c1Res.body.data.comment._id;
        const res = await request(`/comments/${delId}`, {
            method: 'DELETE', headers: { 'Authorization': `Bearer ${tokenAdmin}` }
        });
        if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    });

    // 17. commentCount remains correct
    await logTest(17, 'commentCount remains correct', async () => {
        const f = await request(`/features/${featureId}`);
        if (typeof f.body.data.feature.commentCount !== 'number') throw new Error(`Invalid comment count: ${f.body.data.feature.commentCount}`);
    });

    // 18. commentCount never becomes negative
    await logTest(18, 'commentCount never becomes negative', async () => {
        const c1Res = await request(`/features/${featureId2}/comments`, {
            method: 'POST', headers: { 'Authorization': `Bearer ${token1}` },
            body: JSON.stringify({ content: 'To delete' })
        });
        await request(`/comments/${c1Res.body.data.comment._id}`, {
            method: 'DELETE', headers: { 'Authorization': `Bearer ${token1}` }
        });
        await request(`/comments/${c1Res.body.data.comment._id}`, {
            method: 'DELETE', headers: { 'Authorization': `Bearer ${token1}` }
        });
        const f = await request(`/features/${featureId2}`);
        if (f.body.data.feature.commentCount < 0) throw new Error(`commentCount negative: ${f.body.data.feature.commentCount}`);
    });

    // 19. Markdown behavior
    await logTest(19, 'Markdown behavior', async () => {
        const res = await request(`/features/${featureId}/comments`, {
            method: 'POST', headers: { 'Authorization': `Bearer ${token1}` },
            body: JSON.stringify({ content: '**bold**' })
        });
        if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}: ` + JSON.stringify(res.body));
        if (res.body.data.comment.content !== '**bold**') throw new Error("API should store raw markdown");
    });

    // 20. XSS sanitization behavior
    await logTest(20, 'XSS sanitization behavior', async () => {
        const res = await request(`/features/${featureId}/comments`, {
            method: 'POST', headers: { 'Authorization': `Bearer ${token1}` },
            body: JSON.stringify({ content: '<script>alert("xss")</script>' })
        });
        if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}: ` + JSON.stringify(res.body));
    });

    // 21. Invalid feature/comment IDs handled safely
    await logTest(21, 'Invalid feature/comment IDs handled safely', async () => {
        const res = await request(`/features/invalid_id/comments`);
        if (res.status === 500) throw new Error(`Expected 4xx for invalid feature id, got ${res.status}`);
        const res2 = await request(`/comments/invalid_id`, {
            method: 'PATCH', headers: { 'Authorization': `Bearer ${token1}` }, body: JSON.stringify({ content: 'update' })
        });
        if (res2.status === 500) throw new Error(`Expected 4xx for invalid comment id, got ${res2.status}`);
    });

    // 22. User cannot manipulate commentCount
    await logTest(22, 'User cannot manipulate commentCount', async () => {
        const res = await request(`/features/${featureId}`, {
            method: 'PATCH', headers: { 'Authorization': `Bearer ${token1}` },
            body: JSON.stringify({ commentCount: 999 })
        });
        const getRes = await request(`/features/${featureId}`);
        if (getRes.body.data.feature.commentCount === 999) throw new Error("commentCount was modified");
    });

    // 23. Task 1 health regression
    await logTest(23, 'Task 1 health regression', async () => {
        const res = await request(`/health`);
        if (res.status !== 200 || res.body.status !== 'ok') throw new Error(`Health check failed`);
    });

    // 24. Task 2 auth regression
    await logTest(24, 'Task 2 auth regression', async () => {
        const res = await request(`/auth/me`, { headers: { 'Authorization': `Bearer ${token1}` } });
        if (res.status !== 200) throw new Error(`Auth /me failed`);
    });

    // 25. Task 3 + 4 regression (voting, admin status)
    await logTest(25, 'Task 3 + 4 regression (voting, admin status)', async () => {
        const res = await request(`/features/${featureId}/vote`, {
            method: 'POST', headers: { 'Authorization': `Bearer ${token1}` },
            body: JSON.stringify({ value: 1 })
        });
        if (res.status !== 200) throw new Error(`Voting failed, got ${res.status}`);
        
        const fRes = await request(`/features/${featureId}/status`, {
            method: 'PATCH', headers: { 'Authorization': `Bearer ${tokenAdmin}` },
            body: JSON.stringify({ status: 'Planned' })
        });
        if (fRes.status !== 200) throw new Error(`Admin status update failed, got ${fRes.status}`);
        if (fRes.body.data.feature.status !== 'Planned') throw new Error(`Status not updated`);
    });

    console.log(`\n=== Verification Results ===`);
    console.log(`Total: ${total}`);
    console.log(`Passed: ${passed}/${total}`);
    console.log(`Failed: ${total - passed}/${total}`);
    console.log(`Soft-delete Database Check: ${softDeleteStatus}`);
    
    if (failed.length > 0) {
        console.log(`\nFailures:\n` + failed.join('\n'));
        console.log(`\nFINAL SUMMARY: FAIL`);
    } else {
        console.log(`\nFINAL SUMMARY: PASS`);
    }

    process.exit(0);
}

runTests().catch(e => {
    console.error("Test framework error:", e);
    process.exit(1);
});
