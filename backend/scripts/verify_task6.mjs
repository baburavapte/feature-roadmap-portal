import mongoose from 'mongoose';

const API_URL = 'http://localhost:5000/api';
let passed = 0;
let total = 20;
let failed = [];

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

async function runTests() {
    console.log("Starting Task 6 Verification Tests...\n");
    
    const token1 = await setupUser('User 1', `u1_${Date.now()}@example.com`, 'Password123');
    const tokenAdmin = await setupUser('Admin', `admin_${Date.now()}@example.com`, 'Password123', 'admin');
    
    let featureUrId, featurePId, featureIpId, featureCId;
    
    // Setup features
    const createRes = await request('/features', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token1}` },
        body: JSON.stringify({ title: 'Feature UR', description: 'This is a valid test description', category: 'General' })
    });
    if (createRes.status !== 201) throw new Error("Failed to create Feature UR: " + JSON.stringify(createRes.body));
    featureUrId = createRes.body.data.feature._id;
    
    const createRes2 = await request('/features', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token1}` },
        body: JSON.stringify({ title: 'Feature P', description: 'This is a valid test description', category: 'General' })
    });
    if (createRes2.status !== 201) throw new Error("Failed to create Feature P: " + JSON.stringify(createRes2.body));
    featurePId = createRes2.body.data.feature._id;
    await request(`/features/${featurePId}/status`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${tokenAdmin}` }, body: JSON.stringify({ status: 'Planned' }) });

    const createRes3 = await request('/features', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token1}` },
        body: JSON.stringify({ title: 'Feature IP', description: 'This is a valid test description', category: 'General' })
    });
    if (createRes3.status !== 201) throw new Error("Failed to create Feature IP: " + JSON.stringify(createRes3.body));
    featureIpId = createRes3.body.data.feature._id;
    await request(`/features/${featureIpId}/status`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${tokenAdmin}` }, body: JSON.stringify({ status: 'In Progress' }) });

    const createRes4 = await request('/features', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token1}` },
        body: JSON.stringify({ title: 'Feature C', description: 'This is a valid test description', category: 'General' })
    });
    if (createRes4.status !== 201) throw new Error("Failed to create Feature C: " + JSON.stringify(createRes4.body));
    featureCId = createRes4.body.data.feature._id;
    await request(`/features/${featureCId}/status`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${tokenAdmin}` }, body: JSON.stringify({ status: 'Completed' }) });

    // 1. Public roadmap-related feature retrieval works without authentication.
    await logTest(1, 'Public roadmap retrieval without auth', async () => {
        const res = await request('/features?limit=50');
        if (res.status !== 200 || !Array.isArray(res.body.data.features)) throw new Error('Failed to retrieve features publicly');
    });

    // 2. Under Review filtering works.
    await logTest(2, 'Under Review filtering works', async () => {
        const res = await request('/features?status=Under Review&limit=50');
        const count = res.body.data.features.filter(f => f._id === featureUrId).length;
        if (count === 0) throw new Error('Did not find Under Review feature');
        const others = res.body.data.features.filter(f => f.status !== 'Under Review').length;
        if (others > 0) throw new Error('Found features that are not Under Review');
    });

    // 3. Planned filtering works.
    await logTest(3, 'Planned filtering works', async () => {
        const res = await request('/features?status=Planned&limit=50');
        const count = res.body.data.features.filter(f => f._id === featurePId).length;
        if (count === 0) throw new Error('Did not find Planned feature');
    });

    // 4. In Progress filtering works.
    await logTest(4, 'In Progress filtering works', async () => {
        const res = await request('/features?status=In Progress&limit=50');
        const count = res.body.data.features.filter(f => f._id === featureIpId).length;
        if (count === 0) throw new Error('Did not find In Progress feature');
    });

    // 5. Completed filtering remains supported.
    await logTest(5, 'Completed filtering remains supported', async () => {
        const res = await request('/features?status=Completed&limit=50');
        const count = res.body.data.features.filter(f => f._id === featureCId).length;
        if (count === 0) throw new Error('Did not find Completed feature');
    });

    // 6. Returned feature status matches the requested status.
    await logTest(6, 'Returned feature status matches requested', async () => {
        const res = await request('/features?status=Planned');
        res.body.data.features.forEach(f => {
            if (f.status !== 'Planned') throw new Error('Status mismatch');
        });
    });

    // 7. Sensitive voter information is not exposed.
    await logTest(7, 'Sensitive voter information is not exposed', async () => {
        const res = await request(`/features?status=Planned`);
        res.body.data.features.forEach(f => {
            if (f.voters !== undefined) throw new Error('voters exposed');
        });
    });

    // 8. Unauthenticated status modification is rejected.
    await logTest(8, 'Unauthenticated status modification rejected', async () => {
        const res = await request(`/features/${featureUrId}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'Planned' }) });
        if (res.status !== 401) throw new Error('Expected 401');
    });

    // 9. Non-admin status modification remains rejected.
    await logTest(9, 'Non-admin status modification rejected', async () => {
        const res = await request(`/features/${featureUrId}/status`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${token1}` }, body: JSON.stringify({ status: 'Planned' }) });
        if (res.status !== 403 && res.status !== 401) throw new Error(`Expected 403, got ${res.status}`);
    });

    // 10. Admin status modification still works.
    await logTest(10, 'Admin status modification works', async () => {
        const res = await request(`/features/${featureUrId}/status`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${tokenAdmin}` }, body: JSON.stringify({ status: 'Planned' }) });
        if (res.status !== 200 || res.body.data.feature.status !== 'Planned') throw new Error('Admin failed to update status');
    });

    // 11. Existing Task 3 feature-feed functionality still works.
    await logTest(11, 'Feature-feed functionality works', async () => {
        const res = await request(`/features?sort=newest`);
        if (res.status !== 200 || !res.body.data.features) throw new Error('Feed failed');
    });

    // 12. Existing Task 4 voting functionality still works.
    await logTest(12, 'Voting functionality works', async () => {
        const res = await request(`/features/${featurePId}/vote`, { method: 'POST', headers: { 'Authorization': `Bearer ${token1}` } });
        if (res.status !== 200 || res.body.data.voteCount !== 1) throw new Error('Vote failed');
    });

    // 13. Existing Task 5 comments functionality still works.
    await logTest(13, 'Comments functionality works', async () => {
        const res = await request(`/features/${featurePId}/comments`, { method: 'POST', headers: { 'Authorization': `Bearer ${token1}` }, body: JSON.stringify({ content: 'test comment' }) });
        if (res.status !== 201) throw new Error('Comment failed');
    });

    // 14. Invalid status behavior remains correct.
    await logTest(14, 'Invalid status rejected', async () => {
        const res = await request(`/features/${featurePId}/status`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${tokenAdmin}` }, body: JSON.stringify({ status: 'InvalidStatus' }) });
        if (res.status !== 400) throw new Error('Expected 400 for invalid status');
    });

    // 15. Feature detail access remains functional.
    await logTest(15, 'Feature detail access works', async () => {
        const res = await request(`/features/${featurePId}`);
        if (res.status !== 200 || res.body.data.feature._id !== featurePId) throw new Error('Detail access failed');
    });

    // 16. Backend health remains functional.
    await logTest(16, 'Backend health works', async () => {
        const res = await request(`/health`);
        if (res.status !== 200 || res.body.status !== 'ok') throw new Error('Health check failed');
    });
    
    // 17. Pagination respects limits for roadmap
    await logTest(17, 'Pagination respects limits', async () => {
        const res = await request(`/features?limit=1`);
        if (res.body.data.features.length > 1) throw new Error('Limit not respected');
    });
    
    // 18. Category filter doesn't break status filter
    await logTest(18, 'Multi-filter works', async () => {
        const res = await request(`/features?status=Planned&category=General`);
        if (res.status !== 200) throw new Error('Multi-filter failed');
    });
    
    // 19. Authors are populated in roadmap response
    await logTest(19, 'Authors populated', async () => {
        const res = await request(`/features?status=Planned`);
        if (!res.body.data.features[0].author || !res.body.data.features[0].author.name) throw new Error('Author missing');
    });
    
    // 20. Cannot submit feature with direct status override
    await logTest(20, 'Feature creation ignores status override', async () => {
        const res = await request('/features', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token1}` },
            body: JSON.stringify({ title: 'Override', description: 'This is a valid test description', category: 'General', status: 'Completed' })
        });
        if (res.body.data?.feature?.status === 'Completed') throw new Error('Status overridden on creation');
    });

    console.log(`\n=== Verification Results ===`);
    console.log(`Total: ${total}`);
    console.log(`Passed: ${passed}/${total}`);
    console.log(`Failed: ${total - passed}/${total}`);
    
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
