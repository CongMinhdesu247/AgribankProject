package vn.com.agribank.service.agribankservicecv.config;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
public class ApiAuthenticationInterceptor implements HandlerInterceptor {
    private final JdbcTemplate jdbc;

    @Value("${SESSION_SECRET:}")
    private String secret;

    public ApiAuthenticationInterceptor(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        String path = request.getRequestURI();
        if (path.equals("/api/auth/login") || path.equals("/api/auth/register")) return true;

        String authorization = request.getHeader("Authorization");
        String token = authorization != null && authorization.matches("(?i)^Bearer .+")
                ? authorization.substring(7).trim() : "";
        String[] parts = token.split("\\.", -1);
        if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < 32 || parts.length != 2) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED);
            return false;
        }

        byte[] expected;
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            expected = mac.doFinal(parts[0].getBytes(StandardCharsets.US_ASCII));
            byte[] supplied = Base64.getUrlDecoder().decode(parts[1]);
            if (!MessageDigest.isEqual(expected, supplied)) throw new IllegalArgumentException("bad signature");
            String claims = new String(Base64.getUrlDecoder().decode(parts[0]), StandardCharsets.UTF_8);
            Matcher idClaim = Pattern.compile("\\\"id\\\"\\s*:\\s*(\\d+)").matcher(claims);
            Matcher expiryClaim = Pattern.compile("\\\"expiresAt\\\"\\s*:\\s*(\\d+)").matcher(claims);
            if (!idClaim.find() || !expiryClaim.find()) throw new IllegalArgumentException("invalid claims");
            long id = Long.parseLong(idClaim.group(1));
            long expiresAt = Long.parseLong(expiryClaim.group(1));
            if (id < 1 || expiresAt <= System.currentTimeMillis()) throw new IllegalArgumentException("expired token");

            Map<String, Object> user = jdbc.queryForMap("SELECT id, role FROM users WHERE id = ?", id);
            long userId = ((Number) user.get("id")).longValue();
            String role = String.valueOf(user.get("role"));
            request.setAttribute("authUserId", userId);
            request.setAttribute("authRole", role);

            if (path.matches("/api/tickets/[^/]+/status") && !"TECHNICIAN".equals(role)) {
                response.sendError(HttpServletResponse.SC_FORBIDDEN);
                return false;
            }
            if (path.matches("/api/tickets/[^/]+/comments(?:/.*)?") && !"TECHNICIAN".equals(role)) {
                String ticketId = path.split("/")[3];
                Integer owned = jdbc.queryForObject(
                        "SELECT COUNT(*) FROM tickets WHERE id = ? AND reporter_id = ?", Integer.class, ticketId, userId);
                if (owned == null || owned == 0) {
                    response.sendError(HttpServletResponse.SC_NOT_FOUND);
                    return false;
                }
            }
            return true;
        } catch (Exception invalidTokenOrUser) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED);
            return false;
        }
    }
}
