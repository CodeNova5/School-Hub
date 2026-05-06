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
  
  // Handle _X pattern (single character)
  result = result.replace(/_([a-zA-Z0-9+\-=()]+)/g, (match, content) => {
    return content.split('').map((char: string) => subscripts[char.toLowerCase()] || char).join('');
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
  
  // Handle ^X pattern (single character)
  result = result.replace(/\^([a-zA-Z0-9+\-=()]+)/g, (match, content) => {
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
  
  // 2. Clean up escaped characters
  formatted = cleanEscapedCharacters(formatted);
  
  // 3. Convert subscripts
  formatted = convertSubscripts(formatted);
  
  // 4. Convert superscripts
  formatted = convertSuperscripts(formatted);

  // 4.5 unwrap numeric parentheses that remain
  formatted = unwrapNumericParentheses(formatted);
  
  // 5. Final cleanup: remove multiple spaces
  formatted = formatted.replace(/\s+/g, ' ').trim();
  
  return formatted;
}

/**
 * Format an array of JAMB options
 */
export function formatJambOptions(options: string[]): string[] {
  return options.map(opt => formatJambText(opt));
}
