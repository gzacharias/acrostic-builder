//
//  AppDelegate.swift
//  AcrosticBuilder
//
//  Created by Gail Zacharias on 3/31/26.
//
import Cocoa
import WebKit

// @main
@MainActor
class AppDelegate: NSObject, NSApplicationDelegate, WKUIDelegate, WKNavigationDelegate {
    var window: NSWindow!
    var webView: WKWebView!
    var msgHandler: MessageHandler!

    func applicationDidFinishLaunching(_ aNotification: Notification) {
        let config = WKWebViewConfiguration()
        config.preferences.setValue(true, forKey: "developerExtrasEnabled")

        let msgHandler = MessageHandler()
        config.userContentController.add(msgHandler, name: "save")
        config.userContentController.add(msgHandler, name: "quit")

        window = NSWindow(
            contentRect: NSMakeRect(0, 0, 900, 700),
            styleMask: [.titled, .closable, .resizable, .miniaturizable],
            backing: .buffered,
            defer: false)
        window.title = "Acrostic Builder"
        window.center()

        webView = WKWebView(frame: window.contentView!.bounds, configuration: config)
        msgHandler.webView = webView
        webView.autoresizingMask = [.width, .height]
        webView.uiDelegate = self
        webView.navigationDelegate = self
        window.contentView!.addSubview(webView)

                
        let url = Bundle.main.url(forResource: "acrostics", withExtension: "html")!
        webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        window.makeKeyAndOrderFront(nil)
        NSApp.setActivationPolicy(.regular)
        NSApp.activate(ignoringOtherApps: true)
    }

    // Needed for file input (Load button)
    func webView(_ webView: WKWebView,
                 runOpenPanelWith parameters: WKOpenPanelParameters,
                 initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping ([URL]?) -> Void) {
        let panel = NSOpenPanel()
        panel.canChooseFiles = true
        panel.canChooseDirectories = false
        panel.allowsMultipleSelection = false
        panel.begin { response in
            completionHandler(response == .OK ? panel.urls : nil)
        }
    }
    func webView(_ webView: WKWebView,
                 runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping (Bool) -> Void) {
        let alert = NSAlert()
        alert.messageText = message
        alert.addButton(withTitle: "OK")
        alert.addButton(withTitle: "Cancel")
        completionHandler(alert.runModal() == .alertFirstButtonReturn)
    }
/*
    func applicationWillTerminate(_ aNotification: Notification) {
        // Insert code here to tear down your application
    }

    func applicationSupportsSecureRestorableState(_ app: NSApplication) -> Bool {
        return true
    }
*/

}


class MessageHandler: NSObject, WKScriptMessageHandler {
    weak var webView: WKWebView?
    func userContentController(_ userContentController: WKUserContentController,
                                didReceive message: WKScriptMessage) {
        print("entered controller:",  message.name)
        switch message.name {
        case "save":
            guard let json = message.body as? String else { return }
            DispatchQueue.main.async {
                let panel = NSSavePanel()
                // should check if file already exists and add digits if it does.
                panel.nameFieldStringValue = "acrostic.acr"
                panel.begin { response in
                    if response == .OK {
                        if let url = panel.url {
                            try? json.write(to: url, atomically: true, encoding: .utf8)
                        }
                    }
                }
            }
        case "quit":
            DispatchQueue.main.async { NSApp.terminate(nil) }
        default:
            break
        }
    }
}
