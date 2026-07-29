import fs from 'fs';
import path from 'path';
import https from 'https';
import { execSync } from 'child_process';

const url = 'https://github.com/SagerNet/sing-box/releases/download/v1.13.13/sing-box-1.13.13-windows-amd64.zip';
const destZip = 'sing-box.zip';

console.log(`Downloading ${url}...`);

https.get(url, (res) => {
    if (res.statusCode === 302 || res.statusCode === 301) {
        https.get(res.headers.location, (res2) => {
            const file = fs.createWriteStream(destZip);
            res2.pipe(file);
            file.on('finish', () => {
                file.close();
                console.log('Downloaded zip.');
                extractZip();
            });
        });
    }
});

function extractZip() {
    console.log('Extracting zip...');
    try {
        execSync('powershell.exe -NoProfile -Command "Expand-Archive -Path sing-box.zip -DestinationPath sing-box-extract -Force"');
        const srcExe = path.join('sing-box-extract', 'sing-box-1.13.13-windows-amd64', 'sing-box.exe');
        

        const destDir = path.join('src-tauri', 'bin');
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }
        
        const destExe = path.join(destDir, 'sing-box-x86_64-pc-windows-msvc.exe');
        fs.copyFileSync(srcExe, destExe);
        console.log(`Copied binary to ${destExe}`);
        

        fs.unlinkSync('sing-box.zip');
        execSync('cmd.exe /c "rmdir /S /Q sing-box-extract"');
        console.log('Done.');
    } catch (e) {
        console.error('Error extracting:', e.message);
    }
}
