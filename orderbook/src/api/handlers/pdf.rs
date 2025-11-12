use axum::{
    extract::{Path, State, Multipart},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};
use tracing::{info, error};

use crate::api::{error::ApiResult, state::AppState, ApiError};

#[derive(Debug, Serialize, Deserialize)]
pub struct UploadPdfResponse {
    pub trade_id: String,
    pub filename: String,
    pub size: usize,
    pub uploaded_at: String,
}

/// Upload PDF for a trade
pub async fn upload_pdf_handler(
    State(state): State<AppState>,
    Path(trade_id): Path<String>,
    mut multipart: Multipart,
) -> ApiResult<Json<UploadPdfResponse>> {
    info!("📤 Uploading PDF for trade {}", trade_id);

    // Validate trade exists
    let trade = state.db.get_trade(&trade_id).await?;
    
    // Extract PDF file from multipart data
    let mut pdf_data: Option<Vec<u8>> = None;
    let mut filename: Option<String> = None;
    
    while let Some(field) = multipart.next_field().await.map_err(|e| {
        error!("Failed to read multipart field: {}", e);
        ApiError::BadRequest("Invalid multipart data".to_string())
    })? {
        let field_name = field.name().unwrap_or("").to_string();
        
        if field_name == "pdf" {
            filename = field.file_name().map(|s| s.to_string());
            let data = field.bytes().await.map_err(|e| {
                error!("Failed to read PDF bytes: {}", e);
                ApiError::BadRequest("Failed to read PDF file".to_string())
            })?;
            
            // Validate it's a PDF (simple magic number check)
            if !data.starts_with(b"%PDF") {
                return Err(ApiError::BadRequest("File is not a valid PDF".to_string()));
            }
            
            // Limit PDF size to 10MB
            if data.len() > 10 * 1024 * 1024 {
                return Err(ApiError::BadRequest("PDF file too large (max 10MB)".to_string()));
            }
            
            pdf_data = Some(data.to_vec());
        }
    }
    
    let pdf_data = pdf_data.ok_or_else(|| {
        ApiError::BadRequest("No PDF file provided".to_string())
    })?;
    
    let filename = filename.unwrap_or_else(|| "payment.pdf".to_string());
    
    info!("📄 Saving PDF: {} ({} bytes)", filename, pdf_data.len());
    
    // Save PDF to database
    let uploaded_at = state.db.save_trade_pdf(&trade_id, &pdf_data, &filename).await?;
    
    info!("✅ PDF uploaded successfully for trade {}", trade_id);
    
    Ok(Json(UploadPdfResponse {
        trade_id: trade.trade_id,
        filename,
        size: pdf_data.len(),
        uploaded_at: uploaded_at.to_rfc3339(),
    }))
}

/// Get PDF for a trade
pub async fn get_pdf_handler(
    State(state): State<AppState>,
    Path(trade_id): Path<String>,
) -> ApiResult<Response> {
    info!("📥 Retrieving PDF for trade {}", trade_id);
    
    let trade = state.db.get_trade(&trade_id).await?;
    
    let pdf_data = trade.pdf_file.ok_or_else(|| {
        ApiError::NotFound("No PDF uploaded for this trade".to_string())
    })?;
    
    let filename = trade.pdf_filename.unwrap_or_else(|| "payment.pdf".to_string());
    
    info!("✅ Returning PDF: {} ({} bytes)", filename, pdf_data.len());
    
    // Return PDF as response
    Ok((
        StatusCode::OK,
        [
            (header::CONTENT_TYPE, "application/pdf"),
            (
                header::CONTENT_DISPOSITION,
                &format!("inline; filename=\"{}\"", filename),
            ),
        ],
        pdf_data,
    )
        .into_response())
}

