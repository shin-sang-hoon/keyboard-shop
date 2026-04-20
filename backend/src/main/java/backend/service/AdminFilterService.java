package backend.service;

import backend.dto.FilterDto;
import backend.entity.FilterGroup;
import backend.entity.FilterOption;
import backend.repository.FilterGroupRepository;
import backend.repository.FilterOptionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdminFilterService {

    private final FilterGroupRepository filterGroupRepository;
    private final FilterOptionRepository filterOptionRepository;

    // FilterGroup CRUD
    public List<FilterDto.GroupResponse> getAllGroups() {
        return filterGroupRepository.findAll().stream()
                .map(this::toGroupResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public FilterDto.GroupResponse createGroup(FilterDto.GroupRequest request) {
        FilterGroup group = FilterGroup.builder()
                .name(request.getName())
                .displayOrder(request.getDisplayOrder())
                .build();
        return toGroupResponse(filterGroupRepository.save(group));
    }

    @Transactional
    public FilterDto.GroupResponse updateGroup(Long id, FilterDto.GroupRequest request) {
        FilterGroup group = filterGroupRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("FilterGroup not found"));
        group.setName(request.getName());
        group.setDisplayOrder(request.getDisplayOrder());
        return toGroupResponse(filterGroupRepository.save(group));
    }

    @Transactional
    public void deleteGroup(Long id) {
        filterGroupRepository.deleteById(id);
    }

    // FilterOption CRUD
    @Transactional
    public FilterDto.OptionResponse createOption(FilterDto.OptionRequest request) {
        FilterGroup group = filterGroupRepository.findById(request.getFilterGroupId())
                .orElseThrow(() -> new RuntimeException("FilterGroup not found"));
        FilterOption option = FilterOption.builder()
                .filterGroup(group)
                .name(request.getName())
                .value(request.getValue())
                .displayOrder(request.getDisplayOrder())
                .build();
        return toOptionResponse(filterOptionRepository.save(option));
    }

    @Transactional
    public void deleteOption(Long id) {
        filterOptionRepository.deleteById(id);
    }

    // 변환 메서드
    private FilterDto.GroupResponse toGroupResponse(FilterGroup group) {
        List<FilterDto.OptionResponse> options = group.getOptions().stream()
                .map(this::toOptionResponse)
                .collect(Collectors.toList());
        return FilterDto.GroupResponse.builder()
                .id(group.getId())
                .name(group.getName())
                .displayOrder(group.getDisplayOrder())
                .options(options)
                .build();
    }

    private FilterDto.OptionResponse toOptionResponse(FilterOption option) {
        return FilterDto.OptionResponse.builder()
                .id(option.getId())
                .name(option.getName())
                .value(option.getValue())
                .displayOrder(option.getDisplayOrder())
                .build();
    }
}