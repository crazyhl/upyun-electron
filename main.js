const { app, BrowserWindow, ipcMain } = require('electron')
const fs = require('fs');
const upyun = require('upyun')
const crypto = require('crypto');
const path=require('path');
const uuidv5 = require('uuid/v5');

// 保持对window对象的全局引用，如果不这么做的话，当JavaScript对象被
// 垃圾回收的时候，window对象将会自动的关闭
let win

function createWindow () {
  // 创建浏览器窗口。
  win = new BrowserWindow({
    width: 850,
    height: 600,
    webPreferences: {
      nodeIntegration: true
    },
  })

  // 加载index.html文件
  win.loadFile('index.html')

  // 打开开发者工具
  win.webContents.openDevTools()

  // 当 window 被关闭，这个事件会被触发。
  win.on('closed', () => {
    // 取消引用 window 对象，如果你的应用支持多窗口的话，
    // 通常会把多个 window 对象存放在一个数组里面，
    // 与此同时，你应该删除相应的元素。
    win = null
  })
}

// Electron 会在初始化后并准备
// 创建浏览器窗口时，调用这个函数。
// 部分 API 在 ready 事件触发后才能使用。
app.on('ready', createWindow)

// 当全部窗口关闭时退出。
app.on('window-all-closed', () => {
  // 在 macOS 上，除非用户用 Cmd + Q 确定地退出，
  // 否则绝大部分应用及其菜单栏会保持激活。
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // 在macOS上，当单击dock图标并且没有其他窗口打开时，
  // 通常在应用程序中重新创建一个窗口。
  if (win === null) {
    createWindow()
  }
})

// 在这个文件中，你可以续写应用剩下主进程代码。
// 也可以拆分成几个文件，然后用 require 导入。

// 状态约定  0 准备上传 1 上传中 2 上传成功 -1 不是文件 -2 上传失败 3 排队中

let fileList = [];

const cdnUrl = 'yourCdnBaseUrl';
ipcMain.on('fileAdd', (event, filePath) => {
  console.log(filePath)
  fileStates = fs.lstatSync(filePath);
  isFile = fileStates.isFile();
  if (isFile) {
      // 准备上传
      const service = new upyun.Service('your service name', 'your operate name', 'your operate password')
      const client = new upyun.Client(service);
      const fileExtName = path.extname(filePath);
      console.log('fileExtName:' + fileExtName);
      const date = new Date();
      const dateFormat = '/' + date.getFullYear() + '/' + ("0" + (date.getMonth() + 1)).slice(-2) + '/' + ("0" + date.getDate()).slice(-2);
      const remotePath = dateFormat + '/' + uuidv5(filePath, uuidv5.URL) + fileExtName;
      console.log('remotePath:' + remotePath);
      client.initMultipartUpload(remotePath, filePath).then(function ({fileSize, partCount, uuid}) {
        console.log(fileSize)
        console.log(partCount)
        console.log(uuid)
        event.sender.send('receiveNotice', filePath, 1, 'has-text-info')
        Promise.all(Array.apply(null, {length: partCount}).map((_, partId) => {
          return client.multipartUpload(remotePath, filePath, uuid, partId)
        })).then(function () {
          console.log('finish:' + uuid);
          client.completeMultipartUpload(remotePath, uuid)
          event.sender.send('receiveNotice', filePath, 2, 'has-text-success', cdnUrl + remotePath)
        });
      });
  } else {
    event.reply('receiveNotice', filePath, -1, 'has-text-danger');
  }
})

