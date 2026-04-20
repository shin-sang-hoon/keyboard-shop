package backend.controller;

import backend.dto.FilterDto;
import backend.service.AdminFilterService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/filters")
@RequiredArgsConstructor
@Tag(name = "Admin Filter", description = "관리자 필터 관리 API")
public class AdminFilterController {

    private final AdminFilterService adminFilterService;

    @GetMapping
    @Operation(summary = "필터 그룹 전체 조회")
    public ResponseEntity<List<FilterDto.GroupResponse>> getAllGroups() {
        return ResponseEntity.ok(adminFilterService.getAllGroups());
    }

    @PostMapping("/groups")
    @Operation(summary = "필터 그룹 생성")
    public ResponseEntity<FilterDto.GroupResponse> createGroup(@RequestBody FilterDto.GroupRequest request) {
        return ResponseEntity.ok(adminFilterService.createGroup(request));
    }

    @PutMapping("/groups/{id}")
    @Operation(summary = "필터 그룹 수정")
    public ResponseEntity<FilterDto.GroupResponse> updateGroup(@PathVariable Long id,
                                                               @RequestBody FilterDto.GroupRequest request) {
        return ResponseEntity.ok(adminFilterService.updateGroup(id, request));
    }

    @DeleteMapping("/groups/{id}")
    @Operation(summary = "필터 그룹 삭제")
    public ResponseEntity<Void> deleteGroup(@PathVariable Long id) {
        adminFilterService.deleteGroup(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/options")
    @Operation(summary = "필터 옵션 생성")
    public ResponseEntity<FilterDto.OptionResponse> createOption(@RequestBody FilterDto.OptionRequest request) {
        return ResponseEntity.ok(adminFilterService.createOption(request));
    }

    @DeleteMapping("/options/{id}")
    @Operation(summary = "필터 옵션 삭제")
    public ResponseEntity<Void> deleteOption(@PathVariable Long id) {
        adminFilterService.deleteOption(id);
        return ResponseEntity.noContent().build();
    }
}