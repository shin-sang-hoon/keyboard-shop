package backend.dto;

import org.springframework.data.domain.Sort;

/**
 * 리뷰 정렬 옵션 (5-H B6).
 *
 * 도입 배경:
 *   Spring Data Pageable 의 raw sort 파라미터를 그대로 노출하면
 *   클라이언트가 DB 컬럼명("createdAt", "rating") 에 의존하게 됨.
 *   도메인 enum 으로 추상화하면:
 *     - API 계약이 DB 스키마와 분리 (컬럼명 변경 시 API 영향 0)
 *     - 잘못된 sort 값은 enum 변환 실패 → 자동 400 (GlobalExceptionHandler)
 *     - 추후 정렬 옵션 추가 시 enum 한 줄로 확장
 *     - sort + filter 통합 시 ReviewQuery 객체로 자연 확장 (B7 후)
 *
 * 정렬 정책:
 *   - 모든 옵션에 createdAt DESC tiebreaker 명시 (별점 동일 시 최신순)
 *   - "도움순(helpful)" 은 도움 카운트 컬럼 없어서 보류 — 후속 마이그레이션 후 추가
 *
 * 면접 포인트:
 *   - "API 계약 안정화 — 클라이언트 sort 값과 DB 컬럼명 디커플링"
 *   - "tiebreaker 명시로 페이징 시 결과 안정성 (같은 별점 row 가 페이지 간 안 섞임)"
 */
public enum ReviewSort {

    /** 최신순 (기본) — createdAt DESC */
    LATEST(Sort.by(Sort.Direction.DESC, "createdAt")),

    /** 별점 높은순 — rating DESC, createdAt DESC tiebreaker */
    RATING_DESC(
        Sort.by(Sort.Direction.DESC, "rating")
            .and(Sort.by(Sort.Direction.DESC, "createdAt"))
    ),

    /** 별점 낮은순 — rating ASC, createdAt DESC tiebreaker */
    RATING_ASC(
        Sort.by(Sort.Direction.ASC, "rating")
            .and(Sort.by(Sort.Direction.DESC, "createdAt"))
    ),
    ;

    private final Sort sort;

    ReviewSort(Sort sort) {
        this.sort = sort;
    }

    /** Spring Data 의 Sort 객체로 변환 — Pageable 에 적용 */
    public Sort toSort() {
        return sort;
    }
}
