package backend.dto;

import backend.entity.AuditCategory;
import backend.entity.AuditEventType;
import backend.entity.AuditLog;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * AuditLog 조회용 DTO.
 *
 * 중첩 클래스 패턴 — 기존 BrandDto/CategoryDto 컨벤션 일관성.
 *  - ListItem: 목록 응답 (detail 제외해 페이로드 작게)
 *  - Detail: 단건 조회 (detail JSON 포함)
 *
 * 7-A AuditLog @Aspect 백엔드 (6d984ac) 의 audit_logs 12 컬럼 매핑.
 */
public class AuditLogDto {

    /**
     * 목록 응답 — 표 한 줄에 필요한 핵심 필드만.
     * detail JSON 은 상세 모달에서 별도 조회 (페이로드 절감).
     */
    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ListItem {
        private Long id;
        private Long adminId;
        private String adminEmail;     // User snapshot (User 삭제돼도 추적)
        private AuditCategory category;
        private AuditEventType eventType;
        private String targetType;
        private String targetId;
        private String ipAddress;
        private String result;          // SUCCESS / FAILURE
        private Long durationMs;
        private LocalDateTime createdAt;

        public static ListItem of(AuditLog log) {
            return ListItem.builder()
                    .id(log.getId())
                    .adminId(log.getAdmin() != null ? log.getAdmin().getId() : null)
                    .adminEmail(log.getAdmin() != null ? log.getAdmin().getEmail() : null)
                    .category(log.getCategory())
                    .eventType(log.getEventType())
                    .targetType(log.getTargetType())
                    .targetId(log.getTargetId())
                    .ipAddress(log.getIpAddress())
                    .result(log.getResult())
                    .durationMs(log.getDurationMs())
                    .createdAt(log.getCreatedAt())
                    .build();
        }
    }

    /**
     * 단건 상세 — detail JSON + user_agent 포함.
     */
    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Detail {
        private Long id;
        private Long adminId;
        private String adminEmail;
        private AuditCategory category;
        private AuditEventType eventType;
        private String targetType;
        private String targetId;
        private String detail;          // JSON (마스킹 적용된 인자)
        private String ipAddress;
        private String userAgent;
        private String result;
        private Long durationMs;
        private LocalDateTime createdAt;

        public static Detail of(AuditLog log) {
            return Detail.builder()
                    .id(log.getId())
                    .adminId(log.getAdmin() != null ? log.getAdmin().getId() : null)
                    .adminEmail(log.getAdmin() != null ? log.getAdmin().getEmail() : null)
                    .category(log.getCategory())
                    .eventType(log.getEventType())
                    .targetType(log.getTargetType())
                    .targetId(log.getTargetId())
                    .detail(log.getDetail())
                    .ipAddress(log.getIpAddress())
                    .userAgent(log.getUserAgent())
                    .result(log.getResult())
                    .durationMs(log.getDurationMs())
                    .createdAt(log.getCreatedAt())
                    .build();
        }
    }
}
