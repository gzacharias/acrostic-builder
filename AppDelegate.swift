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
        config.userContentController.add(msgHandler, name: "suggestClues")

#if DEBUG
        let consoleScript = WKUserScript(source: """
 console.log = function(...args) {window.webkit.messageHandlers.consoleLog.postMessage(args.join(' '))};
 """,
                                         injectionTime: .atDocumentStart, forMainFrameOnly: false)
        config.userContentController.addUserScript(consoleScript)
        config.userContentController.add(msgHandler, name: "consoleLog")
#endif

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
    
    lazy var handlers: [String: (WKScriptMessage) -> Void] = [
        "quit": quit_handler,
        "save": save_handler,
        "suggestClues": suggestClues_handler,
        "consoleLog": consoleLog_handler
    ]

    func consoleLog_handler (_ message: WKScriptMessage) {
#if DEBUG
        print("JS:", message.body)
#endif
    }

    func suggestClues_handler(_ message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              let system = body["system"] as? String,
              let words = body["words"] as? String else { return }
        Task {
            do {
                let result = try await Self.callClaude(prompt: system, content: words)
                await MainActor.run {
                    self.webView?.evaluateJavaScript("receive_clue_suggestions(\(result))")
                }
            } catch {
                await MainActor.run {
                    self.webView?.evaluateJavaScript("receive_clue_suggestions(null)")
                }
            }
        }
    }
    static func callClaude(prompt: String, content: String) async throws -> String {
        let url = URL(string: "https://api.anthropic.com/v1/messages")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(anthropic_api_key, forHTTPHeaderField: "x-api-key")
        request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        let body: [String: Any] = [
            "model": "claude-haiku-4-5-20251001",
            "max_tokens": 1024,
            "system": prompt,
            "messages": [["role": "user", "content": content]]
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, _) = try await URLSession.shared.data(for: request)
        // Return raw JSON string to pass back to JS
        return String(data: data, encoding: .utf8)!
    }
    
    func quit_handler(_ message: WKScriptMessage) {
        DispatchQueue.main.async { NSApp.terminate(nil) }
    }
    func save_handler(_ message: WKScriptMessage) {
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
    }

    func userContentController(_ userContentController: WKUserContentController,
                                didReceive message: WKScriptMessage) {
        print("entered controller:",  message.name)
        handlers[message.name]?(message)
    }
}
