package backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 리뷰 별점 분포 통계 DTO (5-H B5).
 *
 * 응답 구조:
 *   {
 *     "productId": 1,
 *     "totalCount": 142,
 *     "averageRating": 4.3,
 *     "distribution": { "1": 5, "2": 8, "3": 12, "4": 47, "5": 70 }
 *   }
 *
 * 설계 결정:
 *  - distribution 키: 1~5 정수 (Integer) — 0.5 단위 9개 버킷이 아닌 5개 버킷
 *      · 한국 쇼핑몰 표준 (네이버쇼핑/쿠팡 모두 정수 5버킷)
 *      · DB 에서 FLOOR(rating) 으로 정규화 (1.5 → 1, 4.5 → 4, 5.0 → 5)
 *      · ⚠️ FLOOR(5.0) = 5 (5★ 가 별도 버킷, 4★ 와 합쳐지지 않음 — 확인됨)
 *  - LinkedHashMap 사용 — 1~5 순서 보장 (프론트 차트 1★ 위→5★ 아래 또는 반대)
 *  - 빈 버킷 보정 — DB 에 row 없는 등급도 0 으로 명시 (프론트가 0% 막대 그리도록)
 *  - totalCount=0, averageRating=null 일 때 distribution 모두 0 (리뷰 없음 케이스)
 *
 * 면접 포인트:
 *  - SQL FLOOR + GROUP BY 로 0.5 단위를 정수 버킷으로 매핑
 *  - DB 결과의 자연스러운 GAP(빈 버킷) 을 Service 가 도메인 의미("0건")로 채워줌
 */
@Getter
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class ReviewStatsDto {

    private Long productId;
    private long totalCount;
    private Double averageRating;          // null = 리뷰 0건
    private Map<Integer, Long> distribution; // key: 1~5, value: 해당 등급 개수

    /**
     * Service 헬퍼 — DB 결과 (List<Object[]>) 를 보정된 distribution Map 으로 변환.
     *
     * @param rawDistribution DB GROUP BY 결과: [bucket(Integer 1~5), count(Long)] 의 리스트
     *                        리뷰 0건 버킷은 row 없음
     * @return 1~5 모든 키 포함 LinkedHashMap (없는 버킷은 0L)
     */
    public static Map<Integer, Long> normalizeDistribution(List<Object[]> rawDistribution) {
        Map<Integer, Long> result = new LinkedHashMap<>();
        // 1~5 순서로 빈 버킷도 명시적 0L 초기화
        for (int i = 1; i <= 5; i++) {
            result.put(i, 0L);
        }
        // DB 결과로 덮어쓰기
        for (Object[] row : rawDistribution) {
            Integer bucket = ((Number) row[0]).intValue();
            Long count = ((Number) row[1]).longValue();
            // 안전 가드 — 1~5 범위 외 데이터 (이론상 발생 X) 무시
            if (bucket >= 1 && bucket <= 5) {
                result.put(bucket, count);
            }
        }
        return result;
    }
}
