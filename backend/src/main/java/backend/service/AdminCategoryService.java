package backend.service;

import backend.dto.CategoryDto;
import backend.entity.Category;
import backend.exception.BusinessException;
import backend.repository.CategoryRepository;
import backend.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

/**
 * 관리자 카테고리 관리 서비스 (7-G R9 보강).
 *
 * 7-G R9 변경점:
 *  - deleteCategory 삭제 가드 2종 추가:
 *      (1) 하위 카테고리 존재 시 거부 — Category.children 이 cascade=ALL 이라
 *          가드 없이 삭제하면 하위 카테고리가 통째로 연쇄 삭제됨.
 *      (2) 이 카테고리를 쓰는 상품 존재 시 거부 — products.category_id FK 보호.
 *  - slug 유니크 사전 검증 — Category.slug UNIQUE 제약을 409 로 변환.
 *  - 자기 자신을 상위로 지정하는 순환 차단.
 *  - RuntimeException → BusinessException — 프로젝트 표준 예외 통일.
 *
 * getAllCategories / toResponse 의 트리 재귀는 기존 그대로 (open-in-view 로 동작).
 */
@Service
@RequiredArgsConstructor
public class AdminCategoryService {

    private final CategoryRepository categoryRepository;
    private final ProductRepository productRepository;

    public List<CategoryDto.Response> getAllCategories() {
        return categoryRepository.findAllWithChildren().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public CategoryDto.Response createCategory(CategoryDto.Request request) {
        validateNameSlug(request.getName(), request.getSlug());
        String slug = request.getSlug().trim();

        // slug 유니크 사전 검증 (Category.slug UNIQUE)
        categoryRepository.findBySlug(slug).ifPresent(c -> {
            throw BusinessException.conflict("이미 존재하는 slug 입니다: " + slug);
        });

        Category parent = resolveParent(request.getParentId(), null);
        Category category = Category.builder()
                .name(request.getName().trim())
                .slug(slug)
                .parent(parent)
                .build();
        return toResponse(categoryRepository.save(category));
    }

    @Transactional
    public CategoryDto.Response updateCategory(Long id, CategoryDto.Request request) {
        validateNameSlug(request.getName(), request.getSlug());
        Category category = categoryRepository.findById(id)
                .orElseThrow(() -> BusinessException.notFound("카테고리를 찾을 수 없습니다: " + id));

        String slug = request.getSlug().trim();
        // 다른 카테고리가 같은 slug 를 쓰고 있으면 거부 (본인은 허용)
        categoryRepository.findBySlug(slug)
                .filter(other -> !other.getId().equals(id))
                .ifPresent(other -> {
                    throw BusinessException.conflict("이미 존재하는 slug 입니다: " + slug);
                });

        Category parent = resolveParent(request.getParentId(), id);
        category.setName(request.getName().trim());
        category.setSlug(slug);
        category.setParent(parent);
        return toResponse(categoryRepository.save(category));
    }

    @Transactional
    public void deleteCategory(Long id) {
        Category category = categoryRepository.findById(id)
                .orElseThrow(() -> BusinessException.notFound("카테고리를 찾을 수 없습니다: " + id));

        // 가드 (1) — 하위 카테고리 존재 시 거부 (cascade=ALL 연쇄 삭제 방지)
        int childCount = category.getChildren() == null ? 0 : category.getChildren().size();
        if (childCount > 0) {
            throw BusinessException.conflict(
                    "하위 카테고리가 " + childCount + "개 있어 삭제할 수 없습니다. 먼저 하위 카테고리를 정리하세요.");
        }

        // 가드 (2) — 이 카테고리를 사용 중인 상품 존재 시 거부
        long inUse = productRepository.countByCategoryId(id);
        if (inUse > 0) {
            throw BusinessException.conflict(
                    "이 카테고리를 사용 중인 상품이 " + inUse + "개 있어 삭제할 수 없습니다.");
        }

        categoryRepository.delete(category);
    }

    // ─────────────────────────────────────────────────────
    // helper
    // ─────────────────────────────────────────────────────

    /**
     * parentId 로 부모 카테고리 조회.
     * @param selfId 수정 중인 카테고리 id — 자기 자신을 상위로 지정하는 순환 차단용. 생성 시 null.
     */
    private Category resolveParent(Long parentId, Long selfId) {
        if (parentId == null) {
            return null;
        }
        if (selfId != null && parentId.equals(selfId)) {
            throw BusinessException.badRequest("카테고리는 자기 자신을 상위로 지정할 수 없습니다.");
        }
        return categoryRepository.findById(parentId)
                .orElseThrow(() -> BusinessException.notFound("상위 카테고리를 찾을 수 없습니다: " + parentId));
    }

    private void validateNameSlug(String name, String slug) {
        if (name == null || name.isBlank()) {
            throw BusinessException.badRequest("카테고리명은 필수입니다.");
        }
        if (slug == null || slug.isBlank()) {
            throw BusinessException.badRequest("slug 는 필수입니다.");
        }
    }

    private CategoryDto.Response toResponse(Category category) {
        List<CategoryDto.Response> children = category.getChildren() == null ? List.of()
                : category.getChildren().stream()
                        .map(this::toResponse)
                        .collect(Collectors.toList());
        return CategoryDto.Response.builder()
                .id(category.getId())
                .name(category.getName())
                .slug(category.getSlug())
                .parentId(category.getParent() != null ? category.getParent().getId() : null)
                .children(children)
                .build();
    }
}
