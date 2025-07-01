const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

// 读取 manifest.json 文件
const manifestPath = path.join(__dirname, 'src', 'manifest.json');
const manifestContent = fs.readFileSync(manifestPath, 'utf8');
const manifest = JSON.parse(manifestContent);
const version = manifest.version;

// 定义压缩文件名
const zipFileName = `chrome-figma-${version}.zip`;
const zipFilePath = path.join(__dirname, zipFileName);

// 检查同名压缩包是否存在，若存在则删除
if (fs.existsSync(zipFilePath)) {
  fs.unlinkSync(zipFilePath);
  console.log(`已删除旧的压缩包: ${zipFileName}`);
}

// 创建输出流
const output = fs.createWriteStream(zipFilePath);
const archive = archiver('zip', {
  zlib: { level: 9 } // 压缩级别
});

// 监听压缩完成事件
output.on('close', () => {
  console.log(`压缩完成，文件大小: ${archive.pointer()} 字节`);
});

// 监听压缩错误事件
archive.on('error', (err) => {
  throw err;
});

// 管道输出流
archive.pipe(output);

// 将 dist 文件夹下的所有内容添加到压缩包
const distPath = path.join(__dirname, 'dist');
archive.directory(distPath, false);

// 完成压缩
archive.finalize();