//! 叙事文本排版：在模型未输出换行时，按句读插入换行

pub fn ensure_narrative_breaks(s: &str) -> String {
    let t = s.trim();
    if t.is_empty() {
        return String::new();
    }
    if t.contains('\n') {
        return t.to_string();
    }
    let mut out = String::new();
    for ch in t.chars() {
        out.push(ch);
        if matches!(ch, '。' | '！' | '？' | '…') {
            out.push('\n');
        }
    }
    out.trim().to_string()
}
