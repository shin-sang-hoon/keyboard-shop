package backend.dto;

/**
 * 관리자 상세정보 + 인라인 이미지 API 요청/응답 (P3 · 5/29).
 * AdminProductController 의 record 요청바디 패턴(StatusUpdateRequest 등)과 동일 스타일.
 */
public class AdminProductDetailDto {

    /** PATCH /api/admin/products/{id}/description 요청 바디 (HTML 본문). */
    public record DescriptionUpdateRequest(String description) {
    }

    /** POST /api/admin/products/{id}/detail-images 응답 — 에디터가 임베드할 URL. */
    public record UploadResponse(String url) {
    }
}
