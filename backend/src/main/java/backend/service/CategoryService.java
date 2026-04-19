package backend.service;

import backend.dto.CategoryDto;
import backend.entity.Category;
import backend.repository.CategoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CategoryService {

    private final CategoryRepository categoryRepository;

    public List<CategoryDto.Response> getAllCategories() {
        // fetch join으로 N+1 해결
        List<Category> categories = categoryRepository.findAllWithChildren();
        return categories.stream()
                .filter(c -> c.getParent() == null)
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public List<CategoryDto.Response> searchByName(String keyword) {
        return categoryRepository.findByNameContainingIgnoreCase(keyword)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    private CategoryDto.Response toResponse(Category c) {
        return CategoryDto.Response.builder()
                .id(c.getId())
                .name(c.getName())
                .slug(c.getSlug())
                .parentId(c.getParent() != null ? c.getParent().getId() : null)
                .children(c.getChildren() != null ?
                        c.getChildren().stream()
                        .map(this::toResponse)
                        .collect(Collectors.toList()) : null)
                .build();
    }
}