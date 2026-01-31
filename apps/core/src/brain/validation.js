/**
 * PRD/TRD Validation Module
 *
 * Validates generated PRD and TRD documents against standardized
 * template requirements. Returns structured validation results with
 * errors (blocking) and warnings (advisory).
 */

import { PRD_TEMPLATE, TRD_TEMPLATE } from './templates.js';

/**
 * Section header patterns for markdown parsing.
 * Maps template section IDs to regex patterns that match
 * the corresponding Chinese markdown headers.
 */
const PRD_SECTION_PATTERNS = {
  background: /^##\s+(背景|需求来源)/m,
  objectives: /^##\s+(目标|功能描述)/m,
  functional_requirements: /^##\s+(功能需求|功能描述)/m,
  acceptance_criteria: /^##\s+(验收标准|成功标准)/m
};

const TRD_SECTION_PATTERNS = {
  technical_background: /^##\s+技术背景/m,
  architecture_design: /^##\s+架构设计/m,
  api_design: /^##\s+API\s*设计/m,
  data_model: /^##\s+数据模型/m,
  test_strategy: /^##\s+测试策略/m
};

const TBD_PATTERNS = [
  /\bTBD\b/i,
  /待定义/,
  /待补充/,
  /TODO/i
];

const MIN_CONTENT_LENGTH = 50;

/**
 * Extract section content between two headers
 * @param {string} content - Full markdown content
 * @param {RegExp} pattern - Section header pattern
 * @returns {string|null} Section content or null if not found
 */
function extractSection(content, pattern) {
  const match = content.match(pattern);
  if (!match) return null;

  const startIdx = match.index + match[0].length;
  const nextHeader = content.slice(startIdx).match(/^##\s+/m);
  const endIdx = nextHeader ? startIdx + nextHeader.index : content.length;

  return content.slice(startIdx, endIdx).trim();
}

/**
 * Check for TBD placeholder patterns in text
 * @param {string} text - Text to check
 * @returns {string[]} List of found TBD patterns
 */
function findTbdPatterns(text) {
  const found = [];
  for (const pattern of TBD_PATTERNS) {
    if (pattern.test(text)) {
      found.push(text.match(pattern)[0]);
    }
  }
  return found;
}

/**
 * Validate a PRD document
 * @param {string} content - PRD markdown content
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
function validatePrd(content) {
  const errors = [];
  const warnings = [];

  if (!content || typeof content !== 'string') {
    return { valid: false, errors: ['Content is empty or not a string'], warnings: [] };
  }

  // Check required sections
  const requiredSections = PRD_TEMPLATE.sections.filter(s => s.required);
  for (const section of requiredSections) {
    const pattern = PRD_SECTION_PATTERNS[section.id];
    if (!pattern) continue;

    const sectionContent = extractSection(content, pattern);
    if (sectionContent === null) {
      errors.push(`Missing required section: ${section.title} (${section.id})`);
    } else {
      const tbds = findTbdPatterns(sectionContent);
      if (tbds.length > 0) {
        warnings.push(`Section "${section.title}" contains placeholder: ${tbds.join(', ')}`);
      }
    }
  }

  // Check minimum content length (excluding frontmatter)
  const bodyContent = content.replace(/^---[\s\S]*?---\s*/m, '').trim();
  if (bodyContent.length < MIN_CONTENT_LENGTH) {
    warnings.push(`Content too short (${bodyContent.length} chars, minimum ${MIN_CONTENT_LENGTH})`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate a TRD document
 * @param {string} content - TRD markdown content
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
function validateTrd(content) {
  const errors = [];
  const warnings = [];

  if (!content || typeof content !== 'string') {
    return { valid: false, errors: ['Content is empty or not a string'], warnings: [] };
  }

  // Check required sections
  const requiredSections = TRD_TEMPLATE.sections.filter(s => s.required);
  for (const section of requiredSections) {
    const pattern = TRD_SECTION_PATTERNS[section.id];
    if (!pattern) continue;

    const sectionContent = extractSection(content, pattern);
    if (sectionContent === null) {
      errors.push(`Missing required section: ${section.title} (${section.id})`);
    } else {
      const tbds = findTbdPatterns(sectionContent);
      if (tbds.length > 0) {
        warnings.push(`Section "${section.title}" contains placeholder: ${tbds.join(', ')}`);
      }
    }
  }

  // Check minimum content length
  const bodyContent = content.replace(/^---[\s\S]*?---\s*/m, '').trim();
  if (bodyContent.length < MIN_CONTENT_LENGTH) {
    warnings.push(`Content too short (${bodyContent.length} chars, minimum ${MIN_CONTENT_LENGTH})`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

export {
  validatePrd,
  validateTrd,
  extractSection,
  findTbdPatterns,
  PRD_SECTION_PATTERNS,
  TRD_SECTION_PATTERNS
};
