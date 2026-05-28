package backend.service;

import backend.dto.SubCategoryDto;
import backend.entity.SubCategory;
import backend.exception.BusinessException;
import backend.repository.ProductRepository;
import backend.repository.SubCategoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 관리자 하위 카테고리 관리 서비스 (P2, 2026-05-28).
 *
 * AdminCategoryService 패턴 준용:
 *  - 삭제 가드: 사용 중인 상품 존재 시 거부 (products.sub_category_id FK 보호) → 409
 *  - '기타'(시드) 삭제 차단 → 400 (기존 상품의 fallback 분류라 항상 존재해야 함)
 *  - 이름 중복 검사: UNIQUE(product_type, name) 를 409 로 변환
 *  - RuntimeException → BusinessException 프로젝트 표준 통일
 *
 * product_type 종속 규칙:
 *  - 생성 시 product_type 필수 + 유효 enum 값 검증
 *  - 수정 시 product_type 변경 불가 (이미 매핑된 상품들과의 정합성 보호) — name/sortOrder 만 변경
 */
@Service
@RequiredArgsConstructor
public class AdminSubCategoryService {

    private final SubCategoryRepository subCategoryRepository;
    private final ProductRepository productRepository;

    /** 유효한 대분류 값 (deprecated MOUSE 포함 — DB 호환). */
    private static final Set<String> VALID_TYPES = Set.of(
            "KEYBOARD", "KEYCAP", "SWITCH_PART", "ACCESSORY", "MOUSE", "NOISE", "UNCLASSIFIED"
    );

    /** 전체 하위분류 조회 (product_type, sort_order, id 순). */
    public List<SubCategoryDto.Response> getAll() {
        return subCategoryRepository.findAllByOrderByProductTypeAscSortOrderAscIdAsc().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    /** 특정 대분류의 하위분류만 조회. */
    public List<SubCategoryDto.Response> getByProductType(String productType) {
        return subCategoryRepository.findByProductTypeOrderBySortOrderAscIdAsc(productType).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public SubCategoryDto.Response create(SubCategoryDto.Request request) {
        String productType = normalizeType(request.getProductType());
        String name = validateName(request.getName());

        // 같은 대분류 안 이름 중복 검사 (UNIQUE(product_type, name))
        subCategoryRepository.findByProductTypeAndName(productType, name).ifPresent(s -> {
            throw BusinessException.conflict(
                    "이미 존재하는 하위 카테고리입니다: [" + productType + "] " + name);
        });

        SubCategory sub = SubCategory.builder()
                .productType(productType)
                .name(name)
                .sortOrder(request.getSortOrder() == null ? 0 : request.getSortOrder())
                .build();
        return toResponse(subCategoryRepository.save(sub));
    }

    @Transactional
    public SubCategoryDto.Response update(Long id, SubCategoryDto.Request request) {
        SubCategory sub = subCategoryRepository.findById(id)
                .orElseThrow(() -> BusinessException.notFound("하위 카테고리를 찾을 수 없습니다: " + id));

        // '기타' 는 이름 변경 불가 (fallback 분류 의미 보존)
        if (sub.isDefault()) {
            throw BusinessException.badRequest("'기타' 하위 카테고리는 수정할 수 없습니다.");
        }

        String name = validateName(request.getName());

        // 같은 대분류 안에서 다른 항목이 같은 이름이면 거부 (본인은 허용)
        subCategoryRepository.findByProductTypeAndName(sub.getProductType(), name)
                .filter(other -> !other.getId().equals(id))
                .ifPresent(other -> {
                    throw BusinessException.conflict(
                            "이미 존재하는 하위 카테고리입니다: [" + sub.getProductType() + "] " + name);
                });

        // product_type 은 변경 불가 — name / sortOrder 만 갱신
        sub.setName(name);
        if (request.getSortOrder() != null) {
            sub.setSortOrder(request.getSortOrder());
        }
        return toResponse(subCategoryRepository.save(sub));
    }

    @Transactional
    public void delete(Long id) {
        SubCategory sub = subCategoryRepository.findById(id)
                .orElseThrow(() -> BusinessException.notFound("하위 카테고리를 찾을 수 없습니다: " + id));

        // 가드 (1) — '기타'(시드) 삭제 차단
        if (sub.isDefault()) {
            throw BusinessException.badRequest(
                    "'기타' 하위 카테고리는 삭제할 수 없습니다. (상품의 기본 분류)");
        }

        // 가드 (2) — 사용 중인 상품 존재 시 거부
        long inUse = productRepository.countBySubCategoryId(id);
        if (inUse > 0) {
            throw BusinessException.conflict(
                    "이 하위 카테고리를 사용 중인 상품이 " + inUse + "개 있어 삭제할 수 없습니다. "
                  + "먼저 해당 상품들의 하위 카테고리를 변경하세요.");
        }

        subCategoryRepository.delete(sub);
    }

    // ─────────────────────────────────────────────────────
    // helper
    // ─────────────────────────────────────────────────────

    private String normalizeType(String raw) {
        if (raw == null || raw.isBlank()) {
            throw BusinessException.badRequest("대분류(product_type)는 필수입니다.");
        }
        String pt = raw.trim().toUpperCase();
        if (!VALID_TYPES.contains(pt)) {
            throw BusinessException.badRequest("유효하지 않은 대분류입니다: " + raw);
        }
        return pt;
    }

    private String validateName(String raw) {
        if (raw == null || raw.isBlank()) {
            throw BusinessException.badRequest("하위 카테고리명은 필수입니다.");
        }
        return raw.trim();
    }

    private SubCategoryDto.Response toResponse(SubCategory sub) {
        long count = productRepository.countBySubCategoryId(sub.getId());
        return SubCategoryDto.Response.of(sub, count);
    }
}
