// test-archive.js - Test Internet Archive integration
import { healthCheck, getServiceInfo, testConnection } from './services/uploadManager.js';

async function testArchiveIntegration() {
    console.log('🧪 Testing Internet Archive Integration...');
    console.log('==========================================');
    
    try {
        // Test 1: Service Info
        console.log('\n1️⃣ Service Information:');
        const serviceInfo = getServiceInfo();
        console.log('   Service:', serviceInfo.name);
        console.log('   Collections:', serviceInfo.collections.join(', '));
        
        // Test 2: Connection Test
        console.log('\n2️⃣ Connection Test:');
        const isConnected = await testConnection();
        console.log('   Status:', isConnected ? '✅ Connected' : '❌ Failed');
        
        // Test 3: Health Check
        console.log('\n3️⃣ Health Check:');
        const health = await healthCheck();
        console.log('   Service:', health.service);
        console.log('   Status:', health.status);
        console.log('   Collections:', health.collections.join(', '));
        
        if (health.status === 'healthy') {
            console.log('\n✅ All tests passed! Internet Archive integration is working.');
        } else {
            console.log('\n❌ Health check failed. Check your credentials and network connection.');
        }
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.log('\n🔧 Troubleshooting:');
        console.log('   1. Check your .env file has correct credentials');
        console.log('   2. Verify UPLOAD_SERVICE=archive');
        console.log('   3. Check your Internet Archive account permissions');
    }
}

testArchiveIntegration();
