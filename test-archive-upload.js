// test-archive-upload.js - Test Internet Archive upload with proper headers
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';

// Hardcoded credentials for testing
const ACCESS_KEY = 't7KE6ywXUPldLwXs';
const SECRET_KEY = 'gN1pCIafrHJjstXc';
const COLLECTION = 'vegaxpixeldrain-movies';

// S3 Client for Internet Archive
const s3Client = new S3Client({
    region: 'us-east-1',
    endpoint: 'https://s3.us.archive.org',
    credentials: {
        accessKeyId: ACCESS_KEY,
        secretAccessKey: SECRET_KEY
    },
    forcePathStyle: true,
    maxAttempts: 1
});

async function testUpload() {
    console.log('🧪 Testing Internet Archive Upload...');
    console.log('=====================================');
    
    // Create a small test file
    const testFileName = 'test-file.txt';
    const testContent = 'This is a test file for Internet Archive upload.';
    
    try {
        // Write test file
        fs.writeFileSync(testFileName, testContent);
        console.log(`\n1️⃣ Created test file: ${testFileName}`);
        
        console.log('\n2️⃣ Testing upload with auto-make-bucket header...');
        
        const uploadCommand = new PutObjectCommand({
            Bucket: COLLECTION,
            Key: testFileName,
            Body: fs.createReadStream(testFileName),
            ContentType: 'text/plain',
            ContentLength: testContent.length,
            Metadata: {
                'auto-make-bucket': '1',
                'meta-mediatype': 'texts',
                'meta-title': 'Test File',
                'meta-description': 'Test upload for VegaXPixelDrain'
            }
        });
        
        console.log('   Sending upload request...');
        const response = await s3Client.send(uploadCommand);
        console.log('   ✅ Upload successful!');
        console.log('   Response:', JSON.stringify(response, null, 2));
        
        // Clean up test file
        fs.unlinkSync(testFileName);
        console.log(`\n3️⃣ Cleaned up test file: ${testFileName}`);
        
    } catch (error) {
        console.log('   ❌ Upload failed:');
        console.log('   Error message:', error.message);
        console.log('   Error name:', error.name);
        console.log('   Error code:', error.$metadata?.httpStatusCode);
        
        // Try to get raw response
        if (error.$response) {
            console.log('\n4️⃣ Raw Response Details:');
            console.log('   Status:', error.$response.statusCode);
            console.log('   Headers:', JSON.stringify(error.$response.headers, null, 2));
            
            // Try to get response body
            try {
                const responseText = await error.$response.body.transformToString();
                console.log('   Body (first 500 chars):', responseText.substring(0, 500));
            } catch (bodyError) {
                console.log('   Could not read response body:', bodyError.message);
            }
        }
        
        // Clean up test file if it exists
        if (fs.existsSync(testFileName)) {
            fs.unlinkSync(testFileName);
            console.log(`\n5️⃣ Cleaned up test file: ${testFileName}`);
        }
    }
}

testUpload();
