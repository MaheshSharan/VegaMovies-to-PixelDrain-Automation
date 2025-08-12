// systemOptimizer.js - System optimizations for large file uploads
import { execSync } from 'child_process';
import os from 'os';

/**
 * Optimize system settings for large file uploads
 */
export function optimizeSystemForUploads() {
    try {
        console.log('[SYSTEM] Optimizing system settings for large file uploads...');

        const platform = os.platform();

        if (platform === 'win32') {
            // Windows optimizations
            console.log('[SYSTEM] Applying Windows network optimizations...');

            // These are safe registry tweaks for network performance
            // Note: These require admin privileges, so we'll just log them
            console.log('[SYSTEM] Recommended Windows optimizations (run as admin):');
            console.log('  - netsh int tcp set global autotuninglevel=normal');
            console.log('  - netsh int tcp set global chimney=enabled');
            console.log('  - netsh int tcp set global rss=enabled');

        } else if (platform === 'linux') {
            // Linux optimizations
            try {
                // Increase network buffer sizes
                execSync('echo "net.core.rmem_max = 134217728" >> /etc/sysctl.conf', { stdio: 'ignore' });
                execSync('echo "net.core.wmem_max = 134217728" >> /etc/sysctl.conf', { stdio: 'ignore' });
                execSync('sysctl -p', { stdio: 'ignore' });
                console.log('[SYSTEM] ✅ Linux network buffers optimized');
            } catch (error) {
                console.log('[SYSTEM] ⚠️ Could not apply Linux optimizations (may need sudo)');
            }
        }

        // Node.js specific optimizations
        process.env.UV_THREADPOOL_SIZE = '16'; // Increase thread pool

        // Increase max listeners to prevent memory leaks
        process.setMaxListeners(20);

        console.log('[SYSTEM] ✅ Node.js optimizations applied');

    } catch (error) {
        console.log('[SYSTEM] ⚠️ Some optimizations could not be applied:', error.message);
    }
}

/**
 * Monitor system resources during upload
 */
export function getSystemStats() {
    const stats = {
        freeMemory: (os.freemem() / 1024 / 1024 / 1024).toFixed(2) + ' GB',
        totalMemory: (os.totalmem() / 1024 / 1024 / 1024).toFixed(2) + ' GB',
        cpuUsage: process.cpuUsage(),
        memoryUsage: process.memoryUsage(),
        uptime: (process.uptime() / 60).toFixed(1) + ' minutes'
    };

    return stats;
}