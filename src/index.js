const {app, dialog, screen, powerMonitor, BrowserWindow, Tray, Menu, Notification} = require('electron')
const process = require('process')
const console = require('console')
const path = require('path')

if(!app.requestSingleInstanceLock()) {
    app.quit()
} else {
console.log(process.env.NODE_ENV)
const showTime = process.env.NODE_ENV == 'dev' ? 5 : 60
const hideTime = process.env.NODE_ENV == 'dev' ? 20 : 1200
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
        backgroundColor: '#dcedc8',
        width: 400,
        height: 300,
        webPreferences: {
            devTools: false,
            sandbox: true
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
        paintWhenInitiallyHidden: false,
        closable: false,
        resizable: false,
        alwaysOnTop: true,
        webPreferences: {
            devTools: false,
            sandbox: true
        }
    }

    if (process.platform === 'linux') {
        windowOptions.icon = path.join(__dirname, 'assets/images/icon-512x512.png')
    }

    let win = new BrowserWindow(windowOptions)
    win.loadFile(path.join(__dirname, 'index.html'))

    win.on('enter-full-screen', () => {
        console.log('休息中')
        showTimeout = setTimeout(() => {
            mainWindows.get(display.id).setKiosk(false)
        }, showTime*1000)
    })

    win.on('leave-full-screen', () => {
        console.log('使用中')
        hideTimeout = setTimeout(() => {
            mainWindows.get(display.id).setKiosk(true)
        }, hideTime*1000)
    })

    win.on('closed', () => {
        clearTimeout(showTimeout)
        clearTimeout(hideTimeout)
        mainWindows.delete(display.id)
    })

    hideTimeout = setTimeout(() => {
        mainWindows.get(display.id).setKiosk(true)
    }, hideTime*1000)

    return win
}

app.on('ready', () => {
    if(process.platform === 'darwin') {
        //app.dock.setIcon(path.join(__dirname, 'assets/images/icon-512x512.png'))
        app.dock.hide()
    }

    screen.getAllDisplays().forEach((display) => {
        mainWindows.set(display.id, createMainWindow(display))
    })

    tray = new Tray(path.join(__dirname, 'assets/images/trayTemplate.png'))
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
        mainWindows.forEach((win) => { win.close() })
    })

    powerMonitor.on('unlock-screen', () => {
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
