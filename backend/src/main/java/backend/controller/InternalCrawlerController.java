package backend.controller;

import backend.dto.InternalProductDtos;
import backend.service.InternalCrawlerService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/internal/crawler")
@RequiredArgsConstructor
@Tag(name = "Internal Crawler", description = "크롤러 내부 API")
public class InternalCrawlerController {

    private final InternalCrawlerService internalCrawlerService;

    /** 단건 upsert (기존 호환 유지) */
    @PostMapping("/upsert")
    @Operation(summary = "상품 단건 upsert (크롤러 전용)")
    public ResponseEntity<InternalProductDtos.UpsertResponse> upsert(
            @RequestHeader("X-Internal-Key") String internalKey,
            @RequestBody InternalProductDtos.UpsertRequest request) {
        return ResponseEntity.ok(internalCrawlerService.upsert(internalKey, request));
    }

    /** 배치 upsert + CrawlLog 자동 저장 */
    @PostMapping("/upsert-batch")
    @Operation(summary = "상품 배치 upsert + CrawlLog 저장 (크롤러 전용)")
    public ResponseEntity<InternalProductDtos.BatchUpsertResponse> batchUpsert(
            @RequestHeader("X-Internal-Key") String internalKey,
            @RequestBody InternalProductDtos.BatchUpsertRequest request) {
        return ResponseEntity.ok(internalCrawlerService.batchUpsert(internalKey, request));
    }
}
