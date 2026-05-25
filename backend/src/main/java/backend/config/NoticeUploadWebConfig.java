package backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Paths;

/**
 * 업로드 파일 정적 서빙 설정 (Phase 7-B).
 *
 * /uploads/** 요청을 서버 로컬 디스크({app.upload.dir})로 매핑한다.
 * 공지 첨부 이미지가 /uploads/notices/{storedName} 으로 접근된다.
 *
 * WebMvcConfigurer 구현체가 프로젝트에 이미 있어도 Spring 은 모든 구현체를
 * 합쳐서 적용하므로 충돌하지 않는다(클래스명을 고유하게 둠). 만약 기존
 * 설정 클래스에 합치고 싶다면 addResourceHandlers 메서드만 옮기면 된다.
 */
@Configuration
public class NoticeUploadWebConfig implements WebMvcConfigurer {

    @Value("${app.upload.dir:./uploads}")
    private String uploadDir;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // 절대경로 + 끝 슬래시 — addResourceLocations 규격.
        String location = "file:" + Paths.get(uploadDir).toAbsolutePath() + "/";
        registry.addResourceHandler("/uploads/**")
                .addResourceLocations(location);
    }
}
