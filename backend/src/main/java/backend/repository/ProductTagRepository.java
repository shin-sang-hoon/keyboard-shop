package backend.repository;

import backend.entity.Product;
import backend.entity.ProductTag;
import backend.entity.Tag;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ProductTagRepository extends JpaRepository<ProductTag, Long> {
    List<ProductTag> findByProductId(Long productId);
    void deleteByProductId(Long productId);
    boolean existsByProductAndTag(Product product, Tag tag);
}