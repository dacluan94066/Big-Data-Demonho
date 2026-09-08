package com.hdfs.clouddrive.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * WebConfig - Cấu hình CORS (Cross-Origin Resource Sharing)
 *
 * Khi Frontend (chạy trên file:// hoặc localhost:3000) gọi API đến
 * Backend (localhost:8080), browser sẽ chặn vì khác origin.
 * Cấu hình này cho phép Frontend gọi tất cả API của Backend.
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOriginPatterns("*")   // Cho phép tất cả origin
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .exposedHeaders("Content-Disposition") // Cần cho download file
                .maxAge(3600);
    }
}
