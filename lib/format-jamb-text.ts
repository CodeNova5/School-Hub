/**
 * Utility functions to properly format JAMB question text and options
 * Handles HTML entity decoding and chemical/mathematical notation conversion
 */

// Decode common HTML entities
function decodeHtmlEntities(text: string): string {
  if (typeof text !== 'string') return '';
  
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&nbsp;': ' ',
    '&copy;': '©',
    '&reg;': '®',
    '&deg;': '°',
    '&frac12;': '½',
    '&frac14;': '¼',
    '&frac34;': '¾',
  };
  
  let decoded = text;
  for (const [entity, char] of Object.entries(entities)) {
    decoded = decoded.replace(new RegExp(entity, 'g'), char);
  }
  
  // Handle numeric entities like &#123; or &#x1F;
  decoded = decoded.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
  decoded = decoded.replace(/&#x([a-fA-F0-9]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
  
  return decoded;
}

// Escape HTML special characters for safe insertion into HTML
function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Wrap detected LaTeX/math fragments in a code tag so a math renderer can process them.
// Matches common LaTeX patterns: $...$, $$...$$, \(...\), \[...\], \frac{..}{..}, \sqrt{..}, \begin{...}...\end{...},
// and general \command{...} sequences.
function wrapMathSegments(text: string): string {
  if (!text) return text;

  // Helper to replace matches with an escaped code wrapper
  const wrap = (m: string) => `<code class="math">\\(${escapeHtml(m)}\\)</code>`;

  // 1. Protect \begin...\end blocks (multi-line matrix/equation blocks)
  text = text.replace(/\\begin\{[a-zA-Z]+\}[\s\S]*?\\end\{[a-zA-Z]+\}/g, (m) => wrap(m));

  // 2. $$...$$ block math
  text = text.replace(/\$\$[\s\S]+?\$\$/g, (m) => wrap(m));

  // 3. $...$ inline math
  text = text.replace(/\$(?:[^$\\]|\\.)+?\$/g, (m) => wrap(m));

  // 4. \(...\) and \[...\]
  text = text.replace(/\\\([\s\S]*?\\\)/g, (m) => wrap(m));
  text = text.replace(/\\\[[\s\S]*?\\\]/g, (m) => wrap(m));

  // 5. \frac{...}{...}
  text = text.replace(/\\frac\s*\{[^}]+\}\s*\{[^}]+\}/g, (m) => wrap(m));

  // 6. \sqrt[...]?{...}
  text = text.replace(/\\sqrt(?:\s*\[[^\]]+\])?\s*\{[^}]+\}/g, (m) => wrap(m));

  // 7. General backslash-command with braced args: \command{...}{...}
  text = text.replace(/\\[a-zA-Z]+(?:\s*\{[^}]*\})+/g, (m) => wrap(m));

  return text;
}

// Apply a transform only to text outside of math code tags
function applyToNonMath(text: string, fn: (s: string) => string): string {
  if (!text) return text;
  const parts = text.split(/(<code class="math">[\s\S]*?<\/code>)/g);
  for (let i = 0; i < parts.length; i++) {
    if (!parts[i]) continue;
    if (parts[i].startsWith('<code class="math">')) continue;
    parts[i] = fn(parts[i]);
  }
  return parts.join('');
}

// Convert subscript notation to Unicode subscripts
// Handles patterns like: H_2SO_4, H_{2}SO_{4}, H_2_O, etc.
function convertSubscripts(text: string): string {
  let result = text;
  
  // Unicode subscript characters
  const subscripts: Record<string, string> = {
    '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
    '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
    'a': 'ₐ', 'e': 'ₑ', 'h': 'ₕ', 'i': 'ᵢ', 'j': 'ⱼ', 'k': 'ₖ',
    'l': 'ₗ', 'm': 'ₘ', 'n': 'ₙ', 'o': 'ₒ', 'p': 'ₚ', 'r': 'ᵣ',
    's': 'ₛ', 't': 'ₜ', 'u': 'ᵤ', 'v': 'ᵥ', 'x': 'ₓ',
    '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
  };
  
  // Handle _{...} pattern (curly braces)
  result = result.replace(/_\{([^}]+)\}/g, (match, content) => {
    return content.split('').map((char: string) => subscripts[char.toLowerCase()] || char).join('');
  });
  
  // Handle _X pattern (single character), but do it iteratively to handle consecutive subscripts
  // This keeps replacing one at a time to avoid regex conflicts
  let lastResult = '';
  while (lastResult !== result) {
    lastResult = result;
    result = result.replace(/_([a-zA-Z0-9+\-=()]\b)/, (match, char) => {
      return subscripts[char.toLowerCase()] || char;
    });
  }
  
  // Also handle cases like _23 or _123 (multiple digits in sequence)
  result = result.replace(/_(\d+)(?=[A-Za-z]|$|\s)/g, (match, digits) => {
    return digits.split('').map((d: string) => subscripts[d] || d).join('');
  });
  
  return result;
}

// Convert superscript notation to Unicode superscripts
// Handles patterns like: 10^23, 10^{23}, x^2, etc.
function convertSuperscripts(text: string): string {
  let result = text;
  
  // Unicode superscript characters
  const superscripts: Record<string, string> = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
    'a': 'ᵃ', 'b': 'ᵇ', 'c': 'ᶜ', 'd': 'ᵈ', 'e': 'ᵉ', 'f': 'ᶠ',
    'g': 'ᵍ', 'h': 'ʰ', 'i': 'ⁱ', 'j': 'ʲ', 'k': 'ᵏ', 'l': 'ˡ',
    'm': 'ᵐ', 'n': 'ⁿ', 'o': 'ᵒ', 'p': 'ᵖ', 'r': 'ʳ', 's': 'ˢ',
    't': 'ᵗ', 'u': 'ᵘ', 'v': 'ᵛ', 'w': 'ʷ', 'x': 'ˣ', 'y': 'ʸ', 'z': 'ᶻ',
    '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
  };
  
  // Handle ^{...} pattern (curly braces)
  result = result.replace(/\^\{([^}]+)\}/g, (match, content) => {
    return content.split('').map((char: string) => superscripts[char.toLowerCase()] || char).join('');
  });
  
  // Handle ^X pattern (single character or multiple digits)
  result = result.replace(/\^(\d+)(?=[A-Za-z]|$|\s)/g, (match, digits) => {
    return digits.split('').map((d: string) => superscripts[d] || d).join('');
  });
  
  result = result.replace(/\^([a-zA-Z+\-=()]+)/g, (match, content) => {
    return content.split('').map((char: string) => superscripts[char.toLowerCase()] || char).join('');
  });
  
  return result;
}

// Clean up escaped characters and backslashes
function cleanEscapedCharacters(text: string): string {
  let result = text;
  
  // Normalize duplicated escape slashes that often come back from the API
  result = result.replace(/\\{2,}/g, '\\');

  // Convert wrapped math fragments like \({23}\) into superscript notation
  result = result.replace(/\\\(\s*\{([^}]+)\}\s*\\?\)/g, '^{$1}');

  // Handle JAMB-style \L_2\) / \R_2\) artifacts before generic cleanup
  result = result.replace(/\\[LR]\s*_\s*(\d+)\s*\\?\)/g, '_$1');

  // Remove unnecessary backslashes before common characters
  result = result.replace(/\\([(){}\[\]_^\-])/g, '$1');
  result = result.replace(/\\[LR]/g, '');
  
  return result;
}

function convertSquareRoots(text: string): string {
  return text.replace(/\\+sqrt(?:\s*\{([^}]+)\}|\s*\(([^)]+)\)|\s+([A-Za-z0-9]+))/g, (_match, braceContent, parenContent, bareContent) => {
    const content = (braceContent || parenContent || bareContent || '').trim();
    if (!content) return '√';

    if (/^[A-Za-z0-9]+$/.test(content)) {
      return `√${content}`;
    }

    return `√(${content})`;
  });
}

function normalizeCommonLatexMath(text: string): string {
  let result = text;

  const symbolReplacements: Array<[RegExp, string]> = [
    [/\\leq/g, '≤'],
    [/\\geq/g, '≥'],
    [/\\le/g, '≤'],
    [/\\ge/g, '≥'],
    [/\\neq/g, '≠'],
    [/\\pm/g, '±'],
    [/\\times/g, '×'],
    [/\\div/g, '÷'],
    [/\\cdot/g, '·'],
    [/\\left/g, ''],
    [/\\right/g, ''],
    [/\\,/g, ' '],
    [/\\;/g, ' '],
    [/\\!/g, ''],
  ];

  for (const [pattern, replacement] of symbolReplacements) {
    result = result.replace(pattern, replacement);
  }

  let previous = '';
  while (previous !== result) {
    previous = result;
    result = result.replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, (_match, numerator: string, denominator: string) => {
      const cleanNumerator = numerator.trim();
      const cleanDenominator = denominator.trim();
      return `(${cleanNumerator}/${cleanDenominator})`;
    });
  }

  return result;
}

function formatJambTextSegment(text: string): string {
  if (!text || typeof text !== 'string') return '';

  let formatted = text.trim();
  formatted = convertSquareRoots(formatted);
  formatted = normalizeCommonLatexMath(formatted);
  formatted = cleanEscapedCharacters(formatted);
  formatted = convertSubscripts(formatted);
  formatted = convertSuperscripts(formatted);
  formatted = unwrapNumericParentheses(formatted);

  return formatted.replace(/\s+/g, ' ').trim();
}

function convertLatexMatrices(text: string): string {
  const matrixRegex = /\\begin\{(pmatrix|bmatrix|Bmatrix|vmatrix|Vmatrix|matrix)\}([\s\S]*?)\\end\{\1\}/g;

  return text.replace(matrixRegex, (_match, environment, body) => {
    const wrappers: Record<string, [string, string]> = {
      matrix: ['(', ')'],
      pmatrix: ['(', ')'],
      bmatrix: ['[', ']'],
      Bmatrix: ['{', '}'],
      vmatrix: ['|', '|'],
      Vmatrix: ['‖', '‖'],
    };

    const [open, close] = wrappers[environment] || ['(', ')'];
    const rows = body
      .split(/\\\\/)
      .map((row: string) => row.trim())
      .filter(Boolean)
      .map((row: string) => {
        const cells = row
          .split('&')
          .map((cell: string) => formatJambTextSegment(cell))
          .filter(Boolean);

        return cells.join(' ');
      })
      .filter(Boolean);

    return `${open}${rows.map((r: any) => `(${r})`).join('\n')}${close}`;
  });
}

function stripOptionPrefix(text: string): string {
  return text.replace(/^\s*(?:option\s*)?[A-D](?:[\.:\-\)])\s*/i, '');
}

// Remove parentheses that wrap only subscript or superscript characters
function unwrapNumericParentheses(text: string): string {
  let result = text;

  // Remove parentheses around Unicode subscript digits: (₂) -> ₂
  result = result.replace(/\(([₀₁₂₃₄₅₆₇₈₉]+)\)/g, (_, digits) => digits);

  // Remove parentheses around Unicode superscript digits: (²) -> ²
  result = result.replace(/\(([⁰¹²³⁴⁵⁶⁷⁸⁹]+)\)/g, (_, digits) => digits);

  // Convert simple patterns like H(2) or O(4) to H₂ or O₄
  result = result.replace(/([A-Za-z])\((\d+)\)/g, (_m, letter, nums) => {
    const subs: Record<string, string> = {
      '0': '₀','1': '₁','2': '₂','3': '₃','4': '₄','5': '₅','6': '₆','7': '₇','8': '₈','9': '₉'
    };
    return letter + nums.split('').map((d: string) => subs[d] || d).join('');
  });

  // Convert simple superscript patterns like x(2) where preceded by ^ or standalone pattern 10(23)
  result = result.replace(/(\d+)\((\d+)\)/g, (_m, base, exp) => {
    const supers: Record<string, string> = {
      '0': '⁰','1': '¹','2': '²','3': '³','4': '⁴','5': '⁵','6': '⁶','7': '⁷','8': '⁸','9': '⁹'
    };
    return base + exp.split('').map((d: string) => supers[d] || d).join('');
  });

  return result;
}

/**
 * Format JAMB question text or options for proper display
 * @param text - The raw text from the API
 * @returns Formatted text with proper Unicode characters and entities decoded
 */
export function formatJambText(text: string): string {
  if (!text || typeof text !== 'string') return '';
  
  let formatted = text.trim();
  
  // 1. Decode HTML entities first
  formatted = decodeHtmlEntities(formatted);

  // Wrap LaTeX/math segments in a code tag so a math renderer can format them.
  formatted = wrapMathSegments(formatted);

  // Apply the remaining normalizations only outside of math code tags so
  // the original LaTeX inside the math wrapper remains intact for rendering.
  formatted = applyToNonMath(formatted, (s) => {
    s = convertSquareRoots(s);
    s = normalizeCommonLatexMath(s);
    s = convertLatexMatrices(s);
    s = cleanEscapedCharacters(s);
    s = convertSubscripts(s);
    s = convertSuperscripts(s);
    s = unwrapNumericParentheses(s);
    return s;
  });
  
  // 5. Final cleanup: remove multiple spaces but preserve newlines
  // Replace sequences of spaces/tabs with a single space, then
  // normalize newline spacing so matrix rows remain on separate lines.
  formatted = applyToNonMath(formatted, (s) => s.replace(/[ \t]+/g, ' ').replace(/\r?\n\s*/g, '\n').replace(/\n{2,}/g, '\n').trim());
  
  return formatted;
}

/**
 * Format an array of JAMB options
 */
export function formatJambOptions(options: string[]): string[] {
  return options.map((opt) => formatJambOptionText(opt));
}

/**
 * Format a single JAMB option for display, removing any scraped A./B./C./D. prefix.
 */
export function formatJambOptionText(text: string): string {
  return stripOptionPrefix(formatJambText(text));
}
