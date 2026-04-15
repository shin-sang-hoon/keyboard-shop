package backend.repository;

import backend.entity.Product;
import backend.entity.Category;
import backend.entity.Brand;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;

public interface ProductRepository extends JpaRepository<Product, Long> {
    List<Product> findByCategory(Category category);
    List<Product> findByBrand(Brand brand);
    List<Product> findByBrandId(Long brandId);
    List<Product> findByBrandName(String brandName);
    List<Product> findByNameContaining(String keyword);

    @Query("SELECT p FROM Product p JOIN FETCH p.category WHERE p.status = 'ON_SALE'")
    List<Product> findAllOnSaleWithCategory();
}