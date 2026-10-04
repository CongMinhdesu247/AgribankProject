package vn.com.agribank.service.agribankservicecv.controller;

import java.util.HashMap;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth") // Thêm /api vào đây cho đồng bộ với TicketController
public class AuthController {

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, Object> credentials) {
        String employeeCode = (String) credentials.get("employeeCode");
        String accountType = (String) credentials.get("accountType");

        Map<String, Object> response = new HashMap<>();
        response.put("token", "agri_token_" + System.currentTimeMillis());
        
        Map<String, Object> user = new HashMap<>();
        user.put("employeeCode", employeeCode);
        user.put("accountType", accountType);
        user.put("fullName", "Cán bộ " + employeeCode);
        
        response.put("user", user);

        return ResponseEntity.ok(response);
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String, Object> accountData) {
        Map<String, Object> response = new HashMap<>();
        response.put("message", "Tạo tài khoản thành công!");
        response.put("token", "agri_token_" + System.currentTimeMillis());
        response.put("user", accountData);

        return ResponseEntity.ok(response);
    }
}