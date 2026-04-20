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
public class AdminCategoryService {

    private final CategoryRepository categoryRepository;

    public List<CategoryDto.Response> getAllCategories() {
        return categoryRepository.findAllWithChildren().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public CategoryDto.Response createCategory(CategoryDto.Request request) {
        Category parent = null;
        if (request.getParentId() != null) {
            parent = categoryRepository.findById(request.getParentId())
                    .orElseThrow(() -> new RuntimeException("Parent category not found"));
        }
        Category category = Category.builder()
                .name(request.getName())
                .slug(request.getSlug())
                .parent(parent)
                .build();
        return toResponse(categoryRepository.save(category));
    }

    @Transactional
    public CategoryDto.Response updateCategory(Long id, CategoryDto.Request request) {
        Category category = categoryRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Category not found"));
        Category parent = null;
        if (request.getParentId() != null) {
            parent = categoryRepository.findById(request.getParentId())
                    .orElseThrow(() -> new RuntimeException("Parent category not found"));
        }
        category.setName(request.getName());
        category.setSlug(request.getSlug());
        category.setParent(parent);
        return toResponse(categoryRepository.save(category));
    }

    @Transactional
    public void deleteCategory(Long id) {
        categoryRepository.deleteById(id);
    }

    private CategoryDto.Response toResponse(Category category) {
        List<CategoryDto.Response> children = category.getChildren() == null ? List.of() :
                category.getChildren().stream()
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