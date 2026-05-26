import { TextDocument } from "vscode-languageserver-textdocument";

export function createDocument(source, uri = "file:///test.momom") {
  return TextDocument.create(uri, "momom", 1, source);
}

export function positionAfter(document, search, offset = 0) {
  const index = document.getText().indexOf(search);
  if (index < 0) {
    throw new Error(`Could not find "${search}" in test document.`);
  }

  return document.positionAt(index + search.length + offset);
}

export function positionAtText(document, search, offset = 0) {
  const index = document.getText().indexOf(search);
  if (index < 0) {
    throw new Error(`Could not find "${search}" in test document.`);
  }

  return document.positionAt(index + offset);
}
