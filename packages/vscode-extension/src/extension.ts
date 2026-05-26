import path from "node:path";
import * as vscode from "vscode";
import {
  LanguageClient,
  TransportKind,
  type LanguageClientOptions,
  type ServerOptions,
} from "vscode-languageclient/node.js";
import { registerMomomCommands } from "./commands.js";
import { MomomDiagnostics } from "./diagnostics.js";
import { MomomVirtualDocumentProvider } from "./preview.js";

let client: LanguageClient | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const diagnostics = new MomomDiagnostics();
  const previewProvider = new MomomVirtualDocumentProvider();
  const fileWatcher = vscode.workspace.createFileSystemWatcher("**/*.momom");
  client = createLanguageClient(context, fileWatcher);

  context.subscriptions.push(
    diagnostics,
    previewProvider,
    fileWatcher,
    vscode.workspace.registerTextDocumentContentProvider("momom-preview", previewProvider),
  );

  registerMomomCommands(context, {
    diagnostics,
    previewProvider,
  });

  await client.start();
}

export async function deactivate(): Promise<void> {
  if (client) {
    await client.stop();
    client = undefined;
  }
}

function createLanguageClient(
  context: vscode.ExtensionContext,
  fileWatcher: vscode.FileSystemWatcher,
): LanguageClient {
  const serverModule = path.resolve(context.extensionPath, "..", "language-server", "dist", "server.js");
  const serverOptions: ServerOptions = {
    run: {
      module: serverModule,
      transport: TransportKind.ipc,
    },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: {
        execArgv: ["--nolazy", "--inspect=6010"],
      },
    },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: "file", language: "momom" },
      { scheme: "untitled", language: "momom" },
    ],
    synchronize: {
      fileEvents: fileWatcher,
    },
  };

  return new LanguageClient("momomLanguageServer", "Momom Language Server", serverOptions, clientOptions);
}
