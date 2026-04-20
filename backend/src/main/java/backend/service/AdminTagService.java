package backend.service;

import backend.dto.TagDto;
import backend.entity.Product;
import backend.entity.ProductTag;
import backend.entity.Tag;
import backend.repository.ProductRepository;
import backend.repository.ProductTagRepository;
import backend.repository.TagRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdminTagService {

    private final TagRepository tagRepository;
    private final ProductTagRepository productTagRepository;
    private final ProductRepository productRepository;

    public List<TagDto.Response> getAllTags() {
        return tagRepository.findAll().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public TagDto.Response createTag(TagDto.Request request) {
        Tag tag = Tag.builder()
                .name(request.getName())
                .color(request.getColor())
                .build();
        return toResponse(tagRepository.save(tag));
    }

    @Transactional
    public TagDto.Response updateTag(Long id, TagDto.Request request) {
        Tag tag = tagRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Tag not found"));
        tag.setName(request.getName());
        tag.setColor(request.getColor());
        return toResponse(tagRepository.save(tag));
    }

    @Transactional
    public void deleteTag(Long id) {
        tagRepository.deleteById(id);
    }

    @Transactional
    public void bulkApply(TagDto.BulkApplyRequest request) {
        Tag tag = tagRepository.findById(request.getTagId())
                .orElseThrow(() -> new RuntimeException("Tag not found"));
        for (Long productId : request.getProductIds()) {
            Product product = productRepository.findById(productId)
                    .orElseThrow(() -> new RuntimeException("Product not found: " + productId));
            boolean exists = productTagRepository.existsByProductAndTag(product, tag);
            if (!exists) {
                ProductTag productTag = ProductTag.builder()
                        .product(product)
                        .tag(tag)
                        .build();
                productTagRepository.save(productTag);
            }
        }
    }

    private TagDto.Response toResponse(Tag tag) {
        return TagDto.Response.builder()
                .id(tag.getId())
                .name(tag.getName())
                .color(tag.getColor())
                .build();
    }
}