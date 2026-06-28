import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  type ElementTransformer,
  type Transformer,
} from "@lexical/markdown";
import {
  $createTableCellNode,
  $createTableNode,
  $createTableRowNode,
  $isTableCellNode,
  $isTableNode,
  $isTableRowNode,
  TableCellHeaderStates,
  TableCellNode,
  TableNode,
  TableRowNode,
} from "@lexical/table";
import { $isParagraphNode, $isTextNode, type ElementNode, type LexicalNode } from "lexical";

const TABLE_ROW_REG_EXP = /^(?:\|)(.+)(?:\|)\s?$/;

/**
 * Whether `line` is a Markdown table delimiter row such as `| --- | :--: |`.
 * Copied from Lexical main — not exported in @lexical/markdown@0.41.
 */
export function isTableRowDivider(line: string): boolean {
  if (line[0] !== "|") {
    return false;
  }
  const { length } = line;
  let i = 1;
  let cells = 0;
  while (i < length) {
    let j = i;
    if (line[j] === " ") {
      j++;
    }
    if (line[j] === ":") {
      j++;
    }
    while (line[j] === "-") {
      j++;
    }
    if (line[j] === ":") {
      j++;
    }
    if (line[j] === " ") {
      j++;
    }
    if (line[j] !== "|") {
      break;
    }
    cells++;
    i = j + 1;
  }
  return cells > 0 && (i === length || (i === length - 1 && /\s/.test(line[i]!)));
}

function getTableColumnsSize(table: TableNode): number {
  const row = table.getFirstChild();
  return $isTableRowNode(row) ? row.getChildrenSize() : 0;
}

export function createMarkdownTableTransformer(
  getCellTransformers: () => Transformer[],
): ElementTransformer {
  const $createTableCell = (textContent: string): TableCellNode => {
    const normalized = textContent.replace(/\\n/g, "\n");
    const cell = $createTableCellNode(TableCellHeaderStates.NO_STATUS);
    $convertFromMarkdownString(normalized, getCellTransformers(), cell);
    return cell;
  };

  const mapToTableCells = (line: string): TableCellNode[] | null => {
    const match = line.match(TABLE_ROW_REG_EXP);
    if (!match?.[1]) {
      return null;
    }
    return match[1].split("|").map((text) => $createTableCell(text));
  };

  return {
    dependencies: [TableNode, TableRowNode, TableCellNode],
    export: (node: LexicalNode) => {
      if (!$isTableNode(node)) {
        return null;
      }

      const output: string[] = [];
      const cellTransformers = getCellTransformers();

      for (const row of node.getChildren()) {
        if (!$isTableRowNode(row)) {
          continue;
        }

        const rowOutput: string[] = [];
        let isHeaderRow = false;

        for (const cell of row.getChildren()) {
          if (!$isTableCellNode(cell)) {
            continue;
          }
          rowOutput.push(
            $convertToMarkdownString(cellTransformers, cell).replace(/\n/g, "\\n").trim(),
          );
          if (cell.__headerState === TableCellHeaderStates.ROW) {
            isHeaderRow = true;
          }
        }

        output.push(`| ${rowOutput.join(" | ")} |`);
        if (isHeaderRow) {
          output.push(`| ${rowOutput.map(() => "---").join(" | ")} |`);
        }
      }

      return output.join("\n");
    },
    regExp: TABLE_ROW_REG_EXP,
    replace: (parentNode: ElementNode, _children, match) => {
      if (isTableRowDivider(match[0]!)) {
        const table = parentNode.getPreviousSibling();
        if (!table || !$isTableNode(table)) {
          return;
        }

        const rows = table.getChildren();
        const lastRow = rows[rows.length - 1];
        if (!lastRow || !$isTableRowNode(lastRow)) {
          return;
        }

        lastRow.getChildren().forEach((cell) => {
          if (!$isTableCellNode(cell)) {
            return;
          }
          cell.setHeaderStyles(TableCellHeaderStates.ROW, TableCellHeaderStates.ROW);
        });

        parentNode.remove();
        return;
      }

      const matchCells = mapToTableCells(match[0]!);
      if (matchCells == null) {
        return;
      }

      const rows = [matchCells];
      let sibling = parentNode.getPreviousSibling();
      let maxCells = matchCells.length;

      while (sibling) {
        if (!$isParagraphNode(sibling)) {
          break;
        }

        if (sibling.getChildrenSize() !== 1) {
          break;
        }

        const firstChild = sibling.getFirstChild();
        if (!$isTextNode(firstChild)) {
          break;
        }

        const cells = mapToTableCells(firstChild.getTextContent());
        if (cells == null) {
          break;
        }

        maxCells = Math.max(maxCells, cells.length);
        rows.unshift(cells);
        const previousSibling = sibling.getPreviousSibling();
        sibling.remove();
        sibling = previousSibling;
      }

      const table = $createTableNode();

      for (const cells of rows) {
        const tableRow = $createTableRowNode();
        table.append(tableRow);

        for (let i = 0; i < maxCells; i++) {
          tableRow.append(i < cells.length ? cells[i]! : $createTableCell(""));
        }
      }

      const previousSibling = parentNode.getPreviousSibling();
      if ($isTableNode(previousSibling) && getTableColumnsSize(previousSibling) === maxCells) {
        previousSibling.append(...table.getChildren());
        parentNode.remove();
      } else {
        parentNode.replace(table);
      }

      table.selectEnd();
    },
    type: "element",
  };
}
