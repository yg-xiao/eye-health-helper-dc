const {app, dialog, screen, powerMonitor, BrowserWindow, Tray, Menu, Notification} = require('electron')
const process = require('process')
const console = require('console')
const path = require('path')

const myModule = require('./module')

if(!app.requestSingleInstanceLock()) {
    app.quit()
} else {
console.log(process.env.NODE_ENV)
const showTime = process.env.NODE_ENV == 'dev' ? 5 : 20
const hideTime = process.env.NODE_ENV == 'dev' ? 60 : 1200
let mainWindows = new Map()
let eyeWindow = null
let tray = null
let menu = Menu.buildFromTemplate([
    {
        click: () => {
            app.showAboutPanel()
        },
        label: '关于',
        type: 'normal'
    },
    {
        click: () => {
            let status = app.getLoginItemSettings().openAtLogin
            let settings = {openAtLogin: !status}
            app.setLoginItemSettings(settings)

            dialog.showMessageBox({
                type: 'info',
                message: settings.openAtLogin?'护眼助手已设为开机自启动。':'护眼助手已取消开机自启动。',
                icon: path.join(__dirname, 'assets/images/icon-512x512.png')
            })
        },
        label: '开机自启动',
        type: 'checkbox',
        checked: app.getLoginItemSettings().openAtLogin,
        enabled: process.platform === 'linux'?false:true
    },
    {
        click: () => {
            if(eyeWindow === null) {
                eyeWindow = createEyeWindow()
            } else {
                eyeWindow.moveTop()
            }
        },
        label: '20-20-20 护眼法则',
        type: 'normal'
    },
    {
        click: () => {
            app.exit()
        },
        label: '退出应用',
        type: 'normal'
    }
])

app.setAboutPanelOptions({
    'applicationName': '护眼助手',
    'applicationVersion': '0.9.0',
    'copyright': 'Copyright © 2020 肖永刚',
    'authors': ['肖永刚 <yongang_xiao@hotmail.com>'],
    'website': 'https://yg-xiao.github.io/eye-health-helper-dc/',
    'iconPath': path.join(__dirname, 'assets/images/icon-512x512.png')//mac不支持
})

function createEyeWindow() {
    const primaryDisplay = screen.getPrimaryDisplay()
    const windowOptions = {
        x: primaryDisplay.bounds.x + (primaryDisplay.workAreaSize.width - 400) / 2,
        y: primaryDisplay.bounds.y + (primaryDisplay.workAreaSize.height - 300) / 2,
        frame: false,
        show: false,
        resizable: false,
        backgroundColor: '#dcedc8',
        width: 400,
        height: 300,
        webPreferences: {
            devTools: process.env.NODE_ENV == 'dev' ? true : false,
            sandbox: process.env.NODE_ENV == 'dev' ? false : true
        }
    }

    if (process.platform === 'linux') {
        windowOptions.icon = path.join(__dirname, 'assets/images/icon-512x512.png')
    }

    let win = new BrowserWindow(windowOptions)
    win.loadFile(path.join(__dirname, 'eye.html'))

    win.once('ready-to-show', () => {
        win.show()
    })
    
    win.on('closed', () => {
        eyeWindow = null
    })

    return win
}

function createMainWindow(display) {
    let showTimeout, hideTimeout

    const windowOptions = {
        width: 0,
        height: 0,
        x: display.bounds.x,
        y: display.bounds.y,
        frame: false,
        backgroundColor: '#dcedc8',
        show: false,
        //closable: false,
        resizable: process.platform === 'win32' ? true : false,
        alwaysOnTop: true,
        icon: path.join(__dirname, 'assets/images/icon-512x512.png'),
        webPreferences: {
            devTools: process.env.NODE_ENV == 'dev' ? true : false,
            sandbox: process.env.NODE_ENV == 'dev' ? false : true
        }
    }

    let win = new BrowserWindow(windowOptions)
    win.loadFile(path.join(__dirname, 'index.html')).then(() => {
        console.log('使用中')
        hideTimeout = setTimeout(() => {
            mainWindows.get(display.id).setFullScreen(true)
            mainWindows.get(display.id).show()
        }, hideTime*1000)
    })

    win.on('enter-full-screen', myModule.debounce(() => {
        console.log('休息中')
        clearTimeout(showTimeout)
        showTimeout = setTimeout(() => {
            mainWindows.get(display.id).setFullScreen(false)
            mainWindows.get(display.id).hide()
        }, showTime*1000)
    }))

    win.on('leave-full-screen', myModule.debounce(() => {
        console.log('使用中')
        clearTimeout(hideTimeout)
        hideTimeout = setTimeout(() => {
            mainWindows.get(display.id).setFullScreen(true)
            mainWindows.get(display.id).show()
        }, hideTime*1000)
    }))

    win.on('closed', () => {
        console.log('closed window')
        clearTimeout(showTimeout)
        clearTimeout(hideTimeout)
        mainWindows.delete(display.id)
    })

    return win
}

app.on('ready', () => {
    if(process.platform === 'darwin') {
        //app.dock.setIcon(path.join(__dirname, 'assets/images/icon-512x512.png'))
        app.dock.hide()
        tray = new Tray(path.join(__dirname, 'assets/images/trayTemplate.png'))
    } else {
        tray = new Tray(path.join(__dirname, 'assets/images/icon-512x512.png'))
    }

    screen.getAllDisplays().forEach((display) => {
        mainWindows.set(display.id, createMainWindow(display))
    })
    
    tray.setToolTip('护眼助手')
    tray.setContextMenu(menu)

    screen.on('display-added', (event, newDisplay) => {
        console.log(newDisplay)
        mainWindows.set(newDisplay.id, createMainWindow(newDisplay))
    })

    screen.on('display-removed', (event, oldDisplay) => {
        console.log(oldDisplay)
        mainWindows.get(oldDisplay.id).close()
    })

    powerMonitor.on('lock-screen', () => {
        console.log('lock-screen')
        mainWindows.forEach((win) => { win.close() })
    })

    powerMonitor.on('unlock-screen', () => {
        console.log('unlock-screen')
        screen.getAllDisplays().forEach((display) => {
            mainWindows.set(display.id, createMainWindow(display))
        })
    })

    let notification = new Notification({
        title: '护眼助手',
        body: '护眼助手正在后台运行。',
        icon: path.join(__dirname, 'assets/images/icon-512x512.png')
    })
    notification.show()
})

app.on('window-all-closed', () => {
    //不需要退出
    /*if(process.platform !== 'darwin') {
        app.quit()
    }*/
})

//mac only
app.on('activate', () => {
    if(mainWindows.size == 0) {
        screen.getAllDisplays().forEach((display) => {
            mainWindows.set(display.id, createMainWindow(display))
        })
    }

    let notification = new Notification({
        title: '护眼助手',
        body: '护眼助手正在后台运行。',
        icon: path.join(__dirname, 'assets/images/icon-512x512.png')
    })
    notification.show()
})

app.on('second-instance', () => {
    app.showAboutPanel()
})

}
