package backend.repository;

import backend.entity.SubCategory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SubCategoryRepository extends JpaRepository<SubCategory, Long> {

    /** 특정 대분류(product_type)의 하위분류 목록 — sort_order, id 순. */
    List<SubCategory> findByProductTypeOrderBySortOrderAscIdAsc(String productType);

    /** 전체 목록 — product_type, sort_order, id 순 (관리자 일괄 조회용). */
    List<SubCategory> findAllByOrderByProductTypeAscSortOrderAscIdAsc();

    /** 같은 대분류 안에서 이름 중복 검사용. */
    Optional<SubCategory> findByProductTypeAndName(String productType, String name);
}
