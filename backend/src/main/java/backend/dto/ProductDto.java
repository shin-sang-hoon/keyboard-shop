package backend.dto;

import backend.entity.Product;
import lombok.*;
import java.time.LocalDateTime;

public class ProductDto {

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Request {
        private String name;
        private Long brandId;
        private Long categoryId;
        private Integer price;
        private Integer stock;
        private String imageUrl;
        private String layout;
        private String switchType;
        private String switchName;
        private String mountingType;
        private String connectionType;
        private String gbStatus;
        private String sourceId;
        private String glbUrl;
        private Product.ProductStatus status;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Response {
        private Long id;
        private String name;
        private String brandName;
        private String categoryName;
        private Integer price;
        private Integer stock;
        private String imageUrl;
        private String layout;
        private String switchType;
        private String switchName;
        private String mountingType;
        private String connectionType;
        private String gbStatus;
        private String sourceId;
        private String glbUrl;
        private Product.ProductStatus status;
        private LocalDateTime createdAt;
    }
}