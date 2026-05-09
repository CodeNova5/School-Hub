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

// Convert subscript notation to Unicode subscripts
function convertSubscripts(text: string): string {
  const subscripts: Record<string, string> = {
    '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
    '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
    'a': 'ₐ', 'e': 'ₑ', 'h': 'ₕ', 'i': 'ᵢ', 'j': 'ⱼ', 'k': 'ₖ',
    'l': 'ₗ', 'm': 'ₘ', 'n': 'ₙ', 'o': 'ₒ', 'p': 'ₚ', 'r': 'ᵣ',
    's': 'ₛ', 't': 'ₜ', 'u': 'ᵤ', 'v': 'ᵥ', 'x': 'ₓ',
    '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
  };

  const convert = (chars: string) =>
    chars.split('').map((c) => subscripts[c.toLowerCase()] ?? c).join('');

  let result = text;
  // _{...} groups
  result = result.replace(/_\{([^}]+)\}/g, (_, g) => convert(g));
  // _digits (one or more)
  result = result.replace(/_(\d+)/g, (_, d) => convert(d));
  // _singleLetter/symbol
  result = result.replace(/_([a-zA-Z+\-=()])/g, (_, c) => subscripts[c.toLowerCase()] ?? c);
  return result;
}

// Convert superscript notation to Unicode superscripts
function convertSuperscripts(text: string): string {
  const superscripts: Record<string, string> = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
    'a': 'ᵃ', 'b': 'ᵇ', 'c': 'ᶜ', 'd': 'ᵈ', 'e': 'ᵉ', 'f': 'ᶠ',
    'g': 'ᵍ', 'h': 'ʰ', 'i': 'ⁱ', 'j': 'ʲ', 'k': 'ᵏ', 'l': 'ˡ',
    'm': 'ᵐ', 'n': 'ⁿ', 'o': 'ᵒ', 'p': 'ᵖ', 'r': 'ʳ', 's': 'ˢ',
    't': 'ᵗ', 'u': 'ᵘ', 'v': 'ᵛ', 'w': 'ʷ', 'x': 'ˣ', 'y': 'ʸ', 'z': 'ᶻ',
    '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
  };

  const convert = (chars: string) =>
    chars.split('').map((c) => superscripts[c.toLowerCase()] ?? c).join('');

  const unwrapPowerGroup = (value: string) => {
    let result = value.trim();

    while (result.startsWith('(') && result.endsWith(')')) {
      const inner = result.slice(1, -1).trim();
      if (!inner) break;
      result = inner;
    }

    return result;
  };

  let result = text;
  // ^(x), ^{(x)}, and similar grouped exponents should render as x²-style
  // superscripts without showing the grouping brackets in the final text.
  result = result.replace(/\^\s*\(([^()]+)\)/g, (_, g) => convert(unwrapPowerGroup(g)));
  result = result.replace(/\^\s*\{\s*([^{}]+?)\s*\}/g, (_, g) => convert(unwrapPowerGroup(g)));
  // ^{...} groups
  result = result.replace(/\^\{([^}]+)\}/g, (_, g) => convert(unwrapPowerGroup(g)));
  // ^digits
  result = result.replace(/\^(\d+)/g, (_, d) => convert(d));
  // ^letters/symbols
  result = result.replace(/\^([a-zA-Z+\-=()]+)/g, (_, c) => convert(c));
  return result;
}

// Clean up escaped characters and backslashes
function cleanEscapedCharacters(text: string): string {
  let result = text;
  result = result.replace(/\\{2,}/g, '\\');
  result = result.replace(/\\\(\s*\{([^}]+)\}\s*\\?\)/g, '^{$1}');
  result = result.replace(/\\[LR]\s*_\s*(\d+)\s*\\?\)/g, '_$1');
  result = result.replace(/\\([(){}\[\]_^\-])/g, '$1');
  result = result.replace(/\\[LR]/g, '');
  return result;
}

function convertSquareRoots(text: string): string {
  return text.replace(
    /\\+sqrt(?:\s*\{([^}]+)\}|\s*\(([^)]+)\)|\s+([A-Za-z0-9]+))/g,
    (_match, braceContent, parenContent, bareContent) => {
      const content = (braceContent || parenContent || bareContent || '').trim();
      if (!content) return '√';
      return /^[A-Za-z0-9]+$/.test(content) ? `√${content}` : `√(${content})`;
    },
  );
}

// ─── FIX: Greek letters & extra symbols ───────────────────────────────────────
function normalizeCommonLatexMath(text: string): string {
  let result = text;

  const symbolReplacements: Array<[RegExp, string]> = [
    [/\\leq/g, '≤'],
    [/\\geq/g, '≥'],
    [/\\le\b/g, '≤'],
    [/\\ge\b/g, '≥'],
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
    // Greek letters (common in physics/maths questions)
    [/\\alpha/g, 'α'],
    [/\\beta/g, 'β'],
    [/\\gamma/g, 'γ'],
    [/\\delta/g, 'δ'],
    [/\\epsilon/g, 'ε'],
    [/\\zeta/g, 'ζ'],
    [/\\eta/g, 'η'],
    [/\\theta/g, 'θ'],
    [/\\lambda/g, 'λ'],
    [/\\mu/g, 'μ'],
    [/\\nu/g, 'ν'],
    [/\\pi/g, 'π'],
    [/\\rho/g, 'ρ'],
    [/\\sigma/g, 'σ'],
    [/\\tau/g, 'τ'],
    [/\\phi/g, 'φ'],
    [/\\chi/g, 'χ'],
    [/\\psi/g, 'ψ'],
    [/\\omega/g, 'ω'],
    [/\\Omega/g, 'Ω'],
    [/\\Delta/g, 'Δ'],
    [/\\Sigma/g, 'Σ'],
    [/\\Pi/g, 'Π'],
    [/\\Theta/g, 'Θ'],
    [/\\Lambda/g, 'Λ'],
    // Misc math
    [/\\infty/g, '∞'],
    [/\\approx/g, '≈'],
    [/\\equiv/g, '≡'],
    [/\\propto/g, '∝'],
    [/\\forall/g, '∀'],
    [/\\exists/g, '∃'],
    [/\\in\b/g, '∈'],
    [/\\notin/g, '∉'],
    [/\\subset/g, '⊂'],
    [/\\cup/g, '∪'],
    [/\\cap/g, '∩'],
    [/\\therefore/g, '∴'],
    [/\\because/g, '∵'],
    [/\\angle/g, '∠'],
    [/\\perp/g, '⊥'],
    [/\\parallel/g, '∥'],
    [/\\rightarrow/g, '→'],
    [/\\leftarrow/g, '←'],
    [/\\Rightarrow/g, '⇒'],
    [/\\Leftrightarrow/g, '⟺'],
  ];

  for (const [pattern, replacement] of symbolReplacements) {
    result = result.replace(pattern, replacement);
  }

  return result;
}

/**
 * FIX: the original code wrapped \frac in double parens — e.g.
 *   \frac{2}{2r-1}  →  ((2/(2r-1)))
 *
 * New logic:
 *   • numerator/denominator are only parenthesised if they contain an
 *     operator ( + - * / ) that would be ambiguous without grouping.
 *   • The fraction itself is written as  num/den  with NO outer parens.
 *     A surrounding expression can add parens if it needs them.
 *
 * Example:  \frac{2}{2r-1} → 2/(2r-1)
 *           \frac{5}{3}    → 5/3
 *           \frac{1}{r+2}  → 1/(r+2)
 */
function convertFractions(text: string): string {
  let result = text;
  let previous = '';
  // Iterate to handle nested fractions from inside out
  while (previous !== result) {
    previous = result;
    result = result.replace(
      /\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g,
      (_match, numerator: string, denominator: string) => {
        const num = numerator.trim();
        const den = denominator.trim();
        // Parenthesise only when the expression contains operators that
        // change meaning without grouping (i.e., the denominator "2r-1"
        // must stay together, but a plain "3" does not need parens).
        const needsNumParens = /[+\-]/.test(num.replace(/^\s*-\s*/, '')) || /[*/]/.test(num);
        const needsDenParens = /[+\-*/]/.test(den);
        const numStr = needsNumParens ? `(${num})` : num;
        const denStr = needsDenParens ? `(${den})` : den;
        return `${numStr}/${denStr}`;
      },
    );
  }
  return result;
}

function convertLatexMatrices(text: string): string {
  const matrixRegex =
    /\\begin\{(pmatrix|bmatrix|Bmatrix|vmatrix|Vmatrix|matrix)\}([\s\S]*?)\\end\{\1\}/g;

  return text.replace(matrixRegex, (_match, environment, body) => {
    const wrappers: Record<string, [string, string]> = {
      matrix:  ['(', ')'],
      pmatrix: ['(', ')'],
      bmatrix: ['[', ']'],
      Bmatrix: ['{', '}'],
      vmatrix: ['|', '|'],
      Vmatrix: ['‖', '‖'],
    };

    const [open, close] = wrappers[environment] ?? ['(', ')'];
    const rows = body
      .split(/\\\\/)
      .map((row: string) => row.trim())
      .filter(Boolean)
      .map((row: string) =>
        row
          .split('&')
          .map((cell: string) => formatJambText(cell))
          .join('  '),
      );

    // Single-row matrix: inline
    if (rows.length === 1) return `${open}${rows[0]}${close}`;
    // Multi-row: one row per line for readability
    return `${open}\n${rows.join('\n')}\n${close}`;
  });
}

function stripOptionPrefix(text: string): string {
  return text.replace(/^\s*(?:option\s*)?[A-D](?:[\.:\-\)])\s*/i, '');
}

// Remove redundant parentheses around lone subscript/superscript Unicode chars
function unwrapNumericParentheses(text: string): string {
  let result = text;
  result = result.replace(/\(([₀₁₂₃₄₅₆₇₈₉]+)\)/g, (_, d) => d);
  result = result.replace(/\(([⁰¹²³⁴⁵⁶⁷⁸⁹]+)\)/g, (_, d) => d);
  // H(2) → H₂  (letter immediately followed by digits in parens)
  result = result.replace(/([A-Za-z])\((\d+)\)/g, (_m, letter, nums) => {
    const subs: Record<string, string> = {
      '0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉',
    };
    return letter + nums.split('').map((d: string) => subs[d] ?? d).join('');
  });
  return result;
}

/**
 * Format JAMB question text or options for proper display.
 * @param text - The raw text from the API
 * @returns Formatted text with proper Unicode characters and entities decoded
 */
export function formatJambText(text: string): string {
  if (!text || typeof text !== 'string') return '';

  let formatted = text.trim();

  // 1. Decode HTML entities
  formatted = decodeHtmlEntities(formatted);

  // 2. Square roots (before generic backslash cleanup)
  formatted = convertSquareRoots(formatted);

  // 3. LaTeX symbol normalisations (Greek letters, relational operators, etc.)
  formatted = normalizeCommonLatexMath(formatted);

  // 4. Fractions — MUST come before cleanEscapedCharacters so \frac is intact
  formatted = convertFractions(formatted);

  // 5. Matrix environments
  formatted = convertLatexMatrices(formatted);

  // 6. Clean stray backslashes / escaped chars
  formatted = cleanEscapedCharacters(formatted);

  // 7. Sub/superscripts
  formatted = convertSubscripts(formatted);
  formatted = convertSuperscripts(formatted);

  // 8. Unwrap redundant parentheses around lone script chars
  formatted = unwrapNumericParentheses(formatted);

  // 9. Whitespace normalisation (preserves matrix newlines)
  formatted = formatted
    .replace(/[ \t]+/g, ' ')
    .replace(/\r?\n\s*/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();

  return formatted;
}

/**
 * Format an array of JAMB options.
 */
export function formatJambOptions(options: string[]): string[] {
  return options.map((opt) => formatJambOptionText(opt));
}

/**
 * Format a single JAMB option, stripping any A./B./C./D. prefix.
 */
export function formatJambOptionText(text: string): string {
  return stripOptionPrefix(formatJambText(text));
}
