package backend.service;

import backend.exception.BusinessException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Set;
import java.util.UUID;

/**
 * 공지 첨부 파일 저장 서비스 (Phase 7-B).
 *
 * 업로드된 이미지를 서버 로컬 디스크({app.upload.dir}/notices/)에 저장한다.
 * S3 연동은 Phase 8 로 보류 — 포트폴리오 데모에는 로컬 디스크로 충분하다.
 * (EC2 배포 시 docker-compose 의 volumes 로 호스트 디렉터리를 마운트하면
 *  컨테이너 재시작에도 파일이 보존된다.)
 *
 * - 허용 타입: 이미지(png/jpg/gif/webp)만.
 * - 저장명: UUID + 확장자 — 원본 파일명 충돌·한글/특수문자 문제 회피.
 * - 접근 URL: /uploads/notices/{storedName} (NoticeUploadWebConfig 정적 매핑).
 */
@Service
public class NoticeFileService {

    @Value("${app.upload.dir:./uploads}")
    private String uploadDir;

    /** 공지 첨부 전용 하위 디렉터리. */
    private static final String SUBDIR = "notices";

    /** 허용 이미지 MIME 타입. */
    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
            "image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"
    );

    /**
     * 디스크 저장 결과 — NoticeAttachment 생성에 필요한 메타.
     */
    public record StoredFile(
            String originalName,
            String storedName,
            String url,
            String contentType,
            long size
    ) {
    }

    /**
     * MultipartFile 한 개를 디스크에 저장하고 메타를 반환한다.
     *
     * @throws BusinessException 빈 파일이거나 이미지가 아닌 경우, 저장 실패 시
     */
    public StoredFile store(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw BusinessException.badRequest("빈 파일은 업로드할 수 없습니다.");
        }
        String contentType = file.getContentType();
        if (contentType == null
                || !ALLOWED_CONTENT_TYPES.contains(contentType.toLowerCase())) {
            throw BusinessException.badRequest(
                    "이미지 파일(png/jpg/gif/webp)만 업로드할 수 있습니다.");
        }

        String ext = extractExtension(file.getOriginalFilename());
        String storedName = UUID.randomUUID().toString().replace("-", "") + ext;

        try {
            Path dir = Paths.get(uploadDir, SUBDIR);
            Files.createDirectories(dir);
            file.transferTo(dir.resolve(storedName));
        } catch (IOException e) {
            throw BusinessException.badRequest("파일 저장에 실패했습니다: " + e.getMessage());
        }

        String url = "/uploads/" + SUBDIR + "/" + storedName;
        return new StoredFile(
                file.getOriginalFilename(),
                storedName,
                url,
                contentType,
                file.getSize()
        );
    }

    /**
     * 디스크에서 저장 파일을 삭제한다.
     * 삭제 실패는 치명적이지 않으므로(DB row 는 이미 제거됨) 예외를 삼킨다.
     */
    public void delete(String storedName) {
        if (storedName == null || storedName.isBlank()) {
            return;
        }
        try {
            Files.deleteIfExists(Paths.get(uploadDir, SUBDIR, storedName));
        } catch (IOException ignored) {
            // 고아 파일이 남을 수 있으나 운영에 영향 없음 — 별도 정리 배치 대상.
        }
    }

    private String extractExtension(String filename) {
        if (filename == null) {
            return "";
        }
        int dot = filename.lastIndexOf('.');
        return dot >= 0 ? filename.substring(dot).toLowerCase() : "";
    }
}
