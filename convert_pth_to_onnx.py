import torch
from torchvision import transforms
from src.model import FaceMaskCNN  # Matches your app.py import structure

def export_to_onnx():
    # 1. Initialize and load the PyTorch model on CPU
    model = FaceMaskCNN()
    model.load_state_dict(torch.load("face_mask_cnn.pth", map_location=torch.device("cpu")))
    model.eval()

    # 2. Create the dummy input tensor matching the expected shape (batch_size, channels, height, width)
    dummy_input = torch.randn(1, 3, 128, 128)

    # 3. Export the model to ONNX format
    output_filename = "face_mask_cnn.onnx"
    print(f"Converting model to {output_filename}...")
    
    torch.onnx.export(
        model,               # The trained model instance
        dummy_input,         # A dummy input tensor with the correct shape
        output_filename,     # Where to save the exported file
        export_params=True,  # Store the trained parameter weights inside the file
        opset_version=11,    # Standard ONNX version compatible with most runtimes
        do_constant_folding=True, # Optimization that simplifies the model graph
        input_names=['input'],    # Label for the input node
        output_names=['output'],  # Label for the output node
        dynamic_axes={'input': {0: 'batch_size'}, 'output': {0: 'batch_size'}} # Allows variable batch sizes
    )
    
    print("Conversion complete!")

if __name__ == "__main__":
    export_to_onnx()