package vn.com.agribank.service.agribankservicecv.controller;

import java.util.HashMap;
import java.util.Map;

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

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, Object> credentials) {
        String employeeCode = (String) credentials.get("employeeCode");
        String accountType = (String) credentials.get("accountType");
        String role = normalizeRole(accountType);

        String empCodeVal = (employeeCode != null && !employeeCode.isBlank()) ? employeeCode : "NV001";

        Map<String, Object> response = new HashMap<>();
        response.put("token", "agri_token_" + System.currentTimeMillis());
        
        Map<String, Object> user = new HashMap<>();
        user.put("employeeCode", empCodeVal);
        // Dùng cùng tên role mà frontend kiểm tra để hiển thị đúng màn hình.
        user.put("accountType", role);
        user.put("role", role);
        user.put("type", role);
        user.put("userType", role);
        user.put("fullName", "Cán bộ " + empCodeVal);
        
        response.put("user", user);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String, Object> accountData) {
        Map<String, Object> response = new HashMap<>();
        String role = normalizeRole((String) accountData.get("accountType"));
        Map<String, Object> user = new HashMap<>(accountData);
        user.put("accountType", role);
        user.put("role", role);

        response.put("message", "Tạo tài khoản thành công!");
        response.put("token", "agri_token_" + System.currentTimeMillis());
        response.put("user", user);
        return ResponseEntity.ok(response);
    }

    private String normalizeRole(String accountType) {
        return "IT_STAFF".equalsIgnoreCase(accountType) ? "IT_STAFF" : "USER";
    }
}
