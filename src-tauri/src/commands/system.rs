//! 系统级操作：在资源管理器中打开路径、读取系统字体

use tracing::debug;

/// 在系统文件管理器中打开指定目录或文件（下载目录、导出位置等）
#[tauri::command]
pub fn open_path_in_explorer(path: String) -> Result<(), String> {
    debug!(path = %path, "打开系统文件管理器");
    open::that(&path).map_err(|e| e.to_string())
}

/// 从系统字体目录读取字体文件，返回 base64 编码的内容。
///
/// jsPDF 仅支持 .ttf，不支持 .ttc（TrueType Collection），
/// 因此只选单体 .ttf 字体文件。
///
/// Windows: `msyhbd.ttf`（雅黑粗）→ `simsun.ttf`（宋体）→ `simhei.ttf`（黑体）
/// macOS:   从 PingFang 目录找 .ttf → STHeiti
#[tauri::command]
pub fn read_system_font() -> Result<ReadFontResult, String> {
    let candidates = if cfg!(target_os = "windows") {
        vec![
            // 优先 ttf（jsPDF 直接支持），然后 ttc（需提取子字体）
            (r"C:\Windows\Fonts\msyh.ttf", "MicrosoftYaHei"),
            (r"C:\Windows\Fonts\msyhbd.ttf", "MicrosoftYaHeiBold"),
            (r"C:\Windows\Fonts\simhei.ttf", "SimHei"),
            (r"C:\Windows\Fonts\simsun.ttf", "SimSun"),
            (r"C:\Windows\Fonts\msyh.ttc", "MicrosoftYaHei"),
        ]
    } else if cfg!(target_os = "macos") {
        vec![
            ("/Library/Fonts/Arial Unicode.ttf", "ArialUnicode"),
            ("/System/Library/Fonts/PingFang.ttc", "PingFang"),
            ("/System/Library/Fonts/Supplemental/Songti.ttc", "Songti"),
        ]
    } else {
        vec![
            (
                "/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf",
                "DroidSans",
            ),
            (
                "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
                "NotoSansCJK",
            ),
        ]
    };

    for (path, name) in &candidates {
        let p = std::path::Path::new(path);
        if p.exists() {
            debug!(font = %path, "读取系统字体");
            let data = std::fs::read(p).map_err(|e| format!("读取字体失败: {e}"))?;

            // jsPDF 不支持 TTC，需提取第一个 TTF 子字体
            let font_data = if path.ends_with(".ttc") {
                extract_first_ttf_from_ttc(&data)?
            } else {
                data
            };

            use base64::Engine;
            let b64 = base64::engine::general_purpose::STANDARD.encode(&font_data);
            return Ok(ReadFontResult {
                name: name.to_string(),
                base64: b64,
            });
        }
    }

    Err("未找到可用的系统中文字体".into())
}

/// 从 TTC（TrueType Collection）中提取第一个 TTF 子字体。
///
/// TTC 文件头：
///   - 4 bytes: tag ("ttcf")
///   - 4 bytes: version
///   - 4 bytes: numFonts
///   - numFonts × 4 bytes: offsets
///
/// 每个 offset 指向一个完整的 TTF（OTF）表目录。
/// 提取方法：读取第一个 TTF 的所有表，拷贝为独立 TTF 文件。
fn extract_first_ttf_from_ttc(data: &[u8]) -> Result<Vec<u8>, String> {
    if data.len() < 12 {
        return Err("TTC 文件太小".into());
    }
    let tag = &data[0..4];
    if tag != b"ttcf" {
        return Err("非有效 TTC 文件".into());
    }

    // 第一个子字体的偏移
    let offset = u32::from_be_bytes(
        data[12..16]
            .try_into()
            .map_err(|_| "读取偏移失败".to_string())?,
    ) as usize;

    if offset + 12 > data.len() {
        return Err("TTC 偏移超出范围".into());
    }

    // 读取 TTF 表目录
    let num_tables = u16::from_be_bytes(
        data[offset + 4..offset + 6]
            .try_into()
            .map_err(|_| "读取表数失败".to_string())?,
    ) as usize;

    let header_size = 12 + num_tables * 16;

    // 收集所有表的范围
    struct TableEntry {
        record: [u8; 16], // 原始 16 字节表记录
        offset: usize,
        length: usize,
    }

    let mut tables = Vec::with_capacity(num_tables);
    for i in 0..num_tables {
        let rec_start = offset + 12 + i * 16;
        let rec_end = rec_start + 16;
        if rec_end > data.len() {
            return Err("TTC 表记录超出范围".into());
        }
        let record: [u8; 16] = data[rec_start..rec_end]
            .try_into()
            .map_err(|_| "表记录读取失败".to_string())?;
        let tbl_offset = u32::from_be_bytes(record[8..12].try_into().unwrap()) as usize;
        let tbl_length = u32::from_be_bytes(record[12..16].try_into().unwrap()) as usize;
        tables.push(TableEntry {
            record,
            offset: tbl_offset,
            length: tbl_length,
        });
    }

    // 构建独立 TTF：先写头 + 表记录，再逐表拷贝数据
    let mut out =
        Vec::with_capacity(header_size + tables.iter().map(|t| (t.length + 3) & !3).sum::<usize>());

    // 写 TTF 头（sfVersion + numTables + searchRange + entrySelector + rangeShift）
    out.extend_from_slice(&data[offset..offset + 12]);

    // 预留表记录空间（后面回填新 offset）
    let records_start = out.len();
    for _ in 0..num_tables {
        out.extend_from_slice(&[0u8; 16]);
    }

    // 逐表写入数据，更新 offset
    for (i, table) in tables.iter().enumerate() {
        let new_offset = out.len() as u32;
        if table.offset + table.length > data.len() {
            return Err("TTC 表数据超出范围".into());
        }
        out.extend_from_slice(&data[table.offset..table.offset + table.length]);
        // 4-byte 对齐
        while out.len() % 4 != 0 {
            out.push(0);
        }

        // 回填表记录：tag(4) + checkSum(4) + offset(4) + length(4)
        let rec_pos = records_start + i * 16;
        out[rec_pos..rec_pos + 8].copy_from_slice(&table.record[0..8]); // tag + checkSum
        out[rec_pos + 8..rec_pos + 12].copy_from_slice(&new_offset.to_be_bytes());
        out[rec_pos + 12..rec_pos + 16].copy_from_slice(&table.record[12..16]); // length
    }

    Ok(out)
}

#[derive(serde::Serialize)]
pub struct ReadFontResult {
    pub name: String,
    pub base64: String,
}
