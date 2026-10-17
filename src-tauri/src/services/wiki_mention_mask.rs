//! 未链接提及扫描前的“可匹配区域”掩码：frontmatter、代码、链接与已有双链不参与提及识别。

use regex::Regex;

pub fn mask_markdown(content: &str) -> Vec<u8> {
    let mut out = content.as_bytes().to_vec();
    let mut in_frontmatter = false;
    let mut in_fence = false;
    let mut offset = 0;
    for (index, line) in content.split_inclusive('\n').enumerate() {
        let trimmed = line.trim();
        let opens_frontmatter = index == 0 && trimmed == "---";
        let fence_marker = trimmed.starts_with("```") || trimmed.starts_with("~~~");
        let mask_line = in_frontmatter
            || opens_frontmatter
            || in_fence
            || fence_marker
            || line.starts_with("    ");
        if mask_line {
            mask_bytes(&mut out, offset, offset + line.len());
        } else {
            mask_inline_range(&mut out, offset, line);
        }
        if opens_frontmatter {
            in_frontmatter = true;
        } else if in_frontmatter && index > 0 && trimmed == "---" {
            in_frontmatter = false;
        } else if !in_frontmatter && fence_marker {
            in_fence = !in_fence;
        }
        offset += line.len();
    }
    out
}

pub fn mask_inline(text: &str) -> Vec<u8> {
    let mut out = text.as_bytes().to_vec();
    mask_inline_range(&mut out, 0, text);
    out
}

fn mask_inline_range(out: &mut [u8], base: usize, line: &str) {
    for start in wiki_ranges(line) {
        mask_bytes(out, base + start.0, base + start.1);
    }
    for start in code_ranges(line) {
        mask_bytes(out, base + start.0, base + start.1);
    }
    let link_re = Regex::new(r"\[[^\]]+\]\([^)]+\)|https?://\S+|www\.\S+").unwrap();
    for found in link_re.find_iter(line) {
        mask_bytes(out, base + found.start(), base + found.end());
    }
}

fn wiki_ranges(text: &str) -> Vec<(usize, usize)> {
    let bytes = text.as_bytes();
    let mut ranges = Vec::new();
    let mut i = 0;
    while i + 1 < bytes.len() {
        if bytes[i] == b'[' && bytes[i + 1] == b'[' {
            if let Some(end) = text[i + 2..].find("]]") {
                ranges.push((i, i + 2 + end + 2));
                i += 2 + end + 2;
                continue;
            }
        }
        i += 1;
    }
    ranges
}

fn code_ranges(text: &str) -> Vec<(usize, usize)> {
    let mut ranges = Vec::new();
    let mut open = None;
    for (index, _) in text.match_indices('`') {
        if let Some(start) = open.take() {
            ranges.push((start, index + 1));
        } else {
            open = Some(index);
        }
    }
    ranges
}

fn mask_bytes(out: &mut [u8], start: usize, end: usize) {
    for byte in out.iter_mut().take(end).skip(start) {
        if *byte != b'\n' {
            *byte = b' ';
        }
    }
}
