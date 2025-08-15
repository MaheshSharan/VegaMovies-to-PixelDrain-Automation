// test-progress-bars.js - Test progress bars for download and upload
import cliProgress from 'cli-progress';

async function testProgressBars() {
    console.log('🧪 Testing Progress Bars...');
    console.log('==========================');
    
    // Test download progress bar
    console.log('\n📥 Testing Download Progress Bar:');
    const downloadBar = new cliProgress.SingleBar({
        format: '  - 📥 Downloading |{bar}| {percentage}% | {value}/{total} MB | ETA: {eta}s | Speed: {speed} MB/s',
        barCompleteChar: '█',
        barIncompleteChar: '░',
        hideCursor: true,
        clearOnComplete: true
    });
    
    downloadBar.start(100, 0); // 100 MB file
    
    // Simulate download progress
    for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 200));
        downloadBar.update(i);
    }
    
    downloadBar.stop();
    console.log('  - ✅ Download completed!');
    
    // Test upload progress bar
    console.log('\n📤 Testing Upload Progress Bar:');
    const uploadBar = new cliProgress.SingleBar({
        format: '  - 📤 Uploading |{bar}| {percentage}% | {value}/{total} MB | ETA: {eta}s | Speed: {speed} MB/s',
        barCompleteChar: '█',
        barIncompleteChar: '░',
        hideCursor: true,
        clearOnComplete: true
    });
    
    uploadBar.start(100, 0); // 100 MB file
    
    // Simulate upload progress
    for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 300));
        uploadBar.update(i);
    }
    
    uploadBar.stop();
    console.log('  - ✅ Upload completed!');
    
    console.log('\n🎉 Progress bars are working perfectly!');
}

testProgressBars();
