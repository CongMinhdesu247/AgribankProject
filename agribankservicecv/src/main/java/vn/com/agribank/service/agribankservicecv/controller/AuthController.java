package vn.com.agribank.service.agribankservicecv.controller;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.bouncycastle.crypto.generators.SCrypt;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final JdbcTemplate jdbcTemplate;

    @Value("${IT_REGISTRATION_CODE:}")
    private String itRegistrationCode;

    public AuthController(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, Object> credentials) {
        String employeeCode = (String) credentials.get("employeeCode");
        String accountType = (String) credentials.get("accountType");
        String password = (String) credentials.get("password");
        String empCodeVal = employeeCode == null ? "" : employeeCode.trim().toUpperCase(Locale.ROOT);
        if (empCodeVal.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vui lòng nhập mã nhân viên");
        }
        List<Map<String, Object>> accounts = jdbcTemplate.queryForList(
                "SELECT id, employee_code, full_name, role, password FROM users WHERE employee_code = ? LIMIT 1",
                empCodeVal);
        if (accounts.isEmpty() || !passwordMatches(password, (String) accounts.get(0).get("password"))) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Mã nhân viên hoặc mật khẩu không đúng");
        }

        Map<String, Object> account = accounts.get(0);
        String role = normalizeRole(String.valueOf(account.get("role")));
        if (!role.equals(normalizeRole(accountType))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Loại tài khoản không khớp");
        }

        Map<String, Object> response = new HashMap<>();
        response.put("token", "agri_token_" + System.currentTimeMillis());
        
        Map<String, Object> user = new HashMap<>();
        Object userId = account.get("id");
        if (userId instanceof Number number) user.put("id", number.longValue());
        user.put("employeeCode", account.getOrDefault("employee_code", empCodeVal));
        // Dùng cùng tên role mà frontend kiểm tra để hiển thị đúng màn hình.
        user.put("accountType", role);
        user.put("role", role);
        user.put("type", role);
        user.put("userType", role);
        user.put("fullName", account.getOrDefault("full_name", "Cán bộ " + empCodeVal));
        
        response.put("user", user);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String, Object> accountData) {
        String employeeCode = stringValue(accountData.get("employeeCode")).trim().toUpperCase(Locale.ROOT);
        String fullName = stringValue(accountData.get("fullName")).trim();
        String branchCode = stringValue(accountData.get("branchCode")).trim().toUpperCase(Locale.ROOT);
        String email = stringValue(accountData.get("email")).trim().toLowerCase(Locale.ROOT);
        String password = stringValue(accountData.get("password"));
        String accountType = stringValue(accountData.get("accountType"));

        if (!employeeCode.matches("[A-Z0-9._-]{2,30}")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mã nhân viên không hợp lệ");
        }
        if (fullName.isBlank() || fullName.length() > 100 || branchCode.isBlank() || branchCode.length() > 20) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vui lòng nhập họ tên và mã chi nhánh hợp lệ");
        }
        if (!email.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+") || email.length() > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email không hợp lệ");
        }
        if (password.length() < 10) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mật khẩu cần có ít nhất 10 ký tự");
        }
        if (!"USER".equalsIgnoreCase(accountType) && !"IT_STAFF".equalsIgnoreCase(accountType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Loại tài khoản không hợp lệ");
        }
        if ("IT_STAFF".equalsIgnoreCase(accountType)
                && (itRegistrationCode == null || itRegistrationCode.isBlank()
                || !itRegistrationCode.equals(stringValue(accountData.get("itRegistrationCode"))))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Mã đăng ký kỹ sư IT không hợp lệ");
        }

        String role = "IT_STAFF".equalsIgnoreCase(accountType) ? "TECHNICIAN" : "REPORTER";
        try {
            jdbcTemplate.update(
                    "INSERT INTO users (username, employee_code, password, full_name, email, role, branch_code) "
                            + "VALUES (?, ?, ?, ?, ?, ?, ?)",
                    employeeCode, employeeCode, hashPassword(password), fullName, email, role, branchCode);
        } catch (DuplicateKeyException exception) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Mã nhân viên hoặc email đã được đăng ký");
        }

        Map<String, Object> user = jdbcTemplate.queryForMap(
                "SELECT id, employee_code, full_name, role FROM users WHERE employee_code = ?",
                employeeCode);
        String publicRole = normalizeRole(String.valueOf(user.get("role")));
        user.put("employeeCode", user.remove("employee_code"));
        user.put("fullName", user.remove("full_name"));
        user.put("role", publicRole);
        user.put("accountType", publicRole);

        Map<String, Object> response = new HashMap<>();
        response.put("message", "Tạo tài khoản thành công!");
        response.put("token", "agri_token_" + System.currentTimeMillis());
        response.put("user", user);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    private String normalizeRole(String accountType) {
        return "IT_STAFF".equalsIgnoreCase(accountType)
                || "TECHNICIAN".equalsIgnoreCase(accountType)
                || "CAN_BO_IT".equalsIgnoreCase(accountType)
                ? "IT_STAFF"
                : "USER";
    }

    private boolean passwordMatches(String suppliedPassword, String storedPassword) {
        if (suppliedPassword == null || storedPassword == null) return false;

        try {
            if (storedPassword.startsWith("scrypt$")) {
                String[] parts = storedPassword.split("\\$", -1);
                if (parts.length != 6) return false;
                int cost = Integer.parseInt(parts[1]);
                int blockSize = Integer.parseInt(parts[2]);
                int parallelization = Integer.parseInt(parts[3]);
                byte[] salt = parts[4].getBytes(StandardCharsets.UTF_8);
                byte[] expected = Base64.getUrlDecoder().decode(parts[5]);
                byte[] actual = SCrypt.generate(
                        suppliedPassword.getBytes(StandardCharsets.UTF_8),
                        salt, cost, blockSize, parallelization, expected.length);
                return MessageDigest.isEqual(actual, expected);
            }

            return MessageDigest.isEqual(
                    suppliedPassword.getBytes(StandardCharsets.UTF_8),
                    storedPassword.getBytes(StandardCharsets.UTF_8));
        } catch (IllegalArgumentException exception) {
            return false;
        }
    }

    private String hashPassword(String password) {
        byte[] saltBytes = new byte[16];
        SECURE_RANDOM.nextBytes(saltBytes);
        String salt = Base64.getUrlEncoder().withoutPadding().encodeToString(saltBytes);
        byte[] key = SCrypt.generate(
                password.getBytes(StandardCharsets.UTF_8),
                salt.getBytes(StandardCharsets.UTF_8), 16384, 8, 1, 64);
        String encodedKey = Base64.getUrlEncoder().withoutPadding().encodeToString(key);
        return "scrypt$16384$8$1$" + salt + "$" + encodedKey;
    }

    private String stringValue(Object value) {
        return value instanceof String string ? string : "";
    }
}
