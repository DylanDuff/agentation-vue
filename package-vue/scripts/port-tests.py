# One-off: mechanical first pass porting upstream toolbar tests to the Vue
# test helpers in src/test-utils.tsx. Usage: python3 port-tests.py in out
import re, sys
src = open(sys.argv[1]).read().replace("\r\n", "\n")
s = src
s = s.replace('"@testing-library/react"', '"../../../test-utils"')
s = s.replace('"../../types"', '"@core/types"')
s = s.replace('"../../utils/', '"@core/utils/')
s = s.replace('"../design-mode/types"', '"@core/components/design-mode/types"')
s = s.replace('from "./index"', 'from "../index"')
s = s.replace('import type { ComponentProps } from "react";\n', 'import type { AgentationProps } from "../index";\n')
s = s.replace('ComponentProps<typeof PageFeedbackToolbarCSS>', 'AgentationProps')
s = s.replace('import { StrictMode } from "react";\n', '')
s = s.replace('className=', 'class=')
# async test bodies
s = re.sub(r'\bit\((("[^"\n]*"|\'[^\'\n]*\'|`[^`\n]*`)),\s*(async\s*)?\(\)\s*=>', r'it(\1, async () =>', s)
s = re.sub(r'\b(beforeEach|afterEach)\((async\s*)?\(\)\s*=>', r'\1(async () =>', s)
# awaits
def add_await(pattern, text):
    return re.sub(r'(?<![\w.])(?<!await )' + pattern, lambda m: 'await ' + m.group(0), text)
s = add_await(r'render\(', s)
s = add_await(r'act\(', s)
s = add_await(r'fireEvent\.\w+\(', s)
s = add_await(r'fireEvent\(', s)
s = re.sub(r'(?<!await )\b(\w+)\.rerender\(', r'await \1.rerender(', s)
s = re.sub(r'(?<!await )\b(view|result|rendered)\.unmount\(', r'await \1.unmount(', s)
s = s.replace('fireEvent.change(', 'fireEvent.input(')
open(sys.argv[2], "w").write(s)

# Second pass: fix shapes the regexes cannot see.
s = open(sys.argv[2]).read()
s = re.sub(r'expect\(\(\) =>(\s*)await render\(', r'await expect(\1render(', s)
s = s.replace(').not.toThrow();', ').resolves.toBeDefined();')
s = s.replace('tabIndex={', 'tabindex={')
s = s.replace('<StrictMode>', '<>').replace('</StrictMode>', '</>')
s = re.sub(r'await act\(\(\) => \{', 'await act(async () => {', s)
s = re.sub(r'(\.each\([^\n]*\)\(("[^"\n]*"|\'[^\'\n]*\'|`[^`\n]*`),\s*)(async\s*)?\(', r'\1async (', s)
open(sys.argv[2], "w").write(s)
