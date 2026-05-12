package backend.service;

import backend.dto.AuditLogDto;
import backend.dto.PagedResponse;
import backend.entity.AuditCategory;
import backend.entity.AuditEventType;
import backend.entity.AuditLog;
import backend.exception.BusinessException;
import backend.repository.AuditLogRepository;
import backend.repository.spec.AuditLogSpecifications;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * AuditLog 조회 서비스 (관리자 뷰어 용).
 *
 * 책임:
 *  - 페이징 + 필터 조합 목록 조회
 *  - 단건 상세 조회 (detail JSON 포함)
 *
 * 본 서비스는 read-only. 저장은 AuditLogEventListener (7-A) 가 담당.
 *
 * 면접 포인트:
 *  - 동적 필터 (Specification 패턴)
 *  - PagedResponse 일관성 (5-G PageImpl 직렬화 fix 패턴)
 *  - createdAt DESC 기본 정렬 (idx_audit_admin_created / idx_audit_category_created 활용)
 */
@Service
@RequiredArgsConstructor
@Slf4j
@Transactional(readOnly = true)
public class AdminAuditLogService {

    private final AuditLogRepository auditLogRepository;

    /**
     * 페이징 + 필터 조합 목록 조회.
     *
     * @param adminId    관리자 ID 필터 (null = 전체)
     * @param category   카테고리 필터 (null = 전체)
     * @param eventType  이벤트 타입 필터 (null = 전체)
     * @param result     결과 필터: SUCCESS / FAILURE (null = 전체)
     * @param dateFrom   시작 시각 (null = 무제한)
     * @param dateTo     종료 시각 (null = 무제한)
     * @param page       페이지 번호 (0-indexed)
     * @param size       페이지 크기 (1~100)
     */
    public PagedResponse<AuditLogDto.ListItem> list(
            Long adminId,
            AuditCategory category,
            AuditEventType eventType,
            String result,
            LocalDateTime dateFrom,
            LocalDateTime dateTo,
            int page,
            int size
    ) {
        // 페이지 크기 안전 가드 (DOS 방어 + 인덱스 효율)
        int safeSize = Math.min(Math.max(size, 1), 100);
        int safePage = Math.max(page, 0);

        Pageable pageable = PageRequest.of(
                safePage, safeSize,
                Sort.by(Sort.Direction.DESC, "createdAt")
        );

        Specification<AuditLog> spec = AuditLogSpecifications.filter(
                adminId, category, eventType, result, dateFrom, dateTo
        );

        Page<AuditLog> result_ = auditLogRepository.findAll(spec, pageable);
        Page<AuditLogDto.ListItem> mapped = result_.map(AuditLogDto.ListItem::of);

        return PagedResponse.from(mapped);
    }

    /**
     * 단건 상세 조회 — detail JSON 포함.
     * 없으면 BusinessException.notFound (404).
     */
    public AuditLogDto.Detail getDetail(Long id) {
        AuditLog log = auditLogRepository.findById(id)
                .orElseThrow(() -> BusinessException.notFound("AuditLog not found: id=" + id));
        return AuditLogDto.Detail.of(log);
    }
}
