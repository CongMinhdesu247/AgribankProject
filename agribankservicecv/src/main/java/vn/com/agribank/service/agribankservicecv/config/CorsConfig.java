package vn.com.agribank.service.agribankservicecv.config; // Đảm bảo đúng package trong dự án của bạn

import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

@Configuration
public class CorsConfig {

    @Value("${CORS_ORIGINS:http://localhost:5173}")
    private String corsOrigins;

    @Bean
    @Order(Ordered.HIGHEST_PRECEDENCE)
    public CorsFilter corsFilter() {
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        CorsConfiguration config = new CorsConfiguration();
        
        // Cho phép gửi credentials (cookie/token header)
        config.setAllowCredentials(true);
        
        // Cấu hình danh sách domain được phép gọi API
        config.setAllowedOrigins(List.of(corsOrigins.split(",")).stream()
                .map(String::trim).filter(origin -> !origin.isBlank()).toList());
        
        config.setAllowedHeaders(List.of("*"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        
        source.registerCorsConfiguration("/**", config);
        return new CorsFilter(source);
    }
}
