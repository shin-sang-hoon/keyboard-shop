package backend.controller;

import backend.dto.CustomBuildDto;
import backend.service.CustomBuildService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/builds")
@RequiredArgsConstructor
@Tag(name = "커스텀 빌드 API", description = "3D 빌더 설정 저장/조회")
public class CustomBuildController {

    private final CustomBuildService customBuildService;

    @PostMapping
    @Operation(summary = "빌드 설정 저장")
    public ResponseEntity<CustomBuildDto.Response> saveBuild(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody CustomBuildDto.Request request) {
        return ResponseEntity.ok(customBuildService.saveBuild(userDetails.getUsername(), request));
    }

    @GetMapping("/my")
    @Operation(summary = "내 빌드 목록 조회")
    public ResponseEntity<List<CustomBuildDto.Response>> getMyBuilds(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(customBuildService.getMyBuilds(userDetails.getUsername()));
    }

    @GetMapping("/{id}")
    @Operation(summary = "빌드 단건 조회")
    public ResponseEntity<CustomBuildDto.Response> getBuild(@PathVariable Long id) {
        return ResponseEntity.ok(customBuildService.getBuild(id));
    }
}