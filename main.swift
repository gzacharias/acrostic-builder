//
//  main.swift
//  AcrosticBuilder
//
//  Created by Gail Zacharias on 3/31/26.
//

import Foundation
import Cocoa

MainActor.assumeIsolated {
    let app = NSApplication.shared
    let delegate = AppDelegate()
    app.delegate = delegate
    app.run()
}
